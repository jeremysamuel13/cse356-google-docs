import { Response } from 'express'
import { fromUint8Array } from 'js-base64';
import { mergeUpdates } from 'yjs'
import { ymongo } from '.';


interface BaseMessage {
    id: string,
}

export interface OpMessage extends BaseMessage {
    payload: string
}

export interface PresenceMessage extends BaseMessage {
    cursor: {
        index: number,
        length: number
    },
    name: string,
    session_id: string
}

export type BroadcastMessage = OpMessage | PresenceMessage

export enum EventType {
    Sync = "sync",
    Update = "update",
    Presence = "presence"
}

export interface Clients {
    [key: string]: ClientManager
}


export interface Event {
    event: EventType,
    data: any,
    client_id: string
}

export type Cursor = {
    index: number
    length: number
} | {}

export class Client {
    client_id: string;
    res: Map<string, Response>;
    cursor: Cursor;
    name: string;

    constructor(res: Response, client_id: string, name: string, uuid: string) {
        this.client_id = client_id
        this.res = new Map()
        this.res.set(uuid, res)
        this.cursor = {}
        this.name = name;
    }

    send(data: string, event: EventType) {
        Promise.all(Array.from(this.res.values()).map(res => {
            let str = `event: ${event}\ndata: ${data}\n id: ${this.client_id}\n\n`
            if (!res.writableEnded) {
                res.write(str)
            }
        }))
    }

    setCursor(index: number, length: number) {
        this.cursor = { index, length }
    }

    clearCursor() {
        this.cursor = {}
    }

    push(res: Response, uuid: string) {
        this.res[uuid] = res
    }

    remove(uuid: string) {
        if (this.res[uuid]) {
            delete this.res[uuid]
        }

        return Object.keys(this.res).length
    }
}

const FLUSH_PRESENCE_INTERVAL = 1500
const FLUSH_UPDATE_INTERVAL = 1500


export class ClientManager {
    doc_id: string
    clients: Map<string, Client>
    updates: Array<Uint8Array>
    update_interval: NodeJS.Timer | null
    presence_queue: Array<string>
    presence_interval: NodeJS.Timer | null


    constructor(id: string) {
        this.doc_id = id
        this.clients = new Map()
        this.updates = []
        this.presence_queue = []
        this.update_interval = null
        this.presence_interval = null
    }

    queueUpdate(update: Uint8Array) {
        this.updates.push(update)

        if (!this.update_interval) {
            this.update_interval = setInterval(async () => {
                if (this.updates.length === 0) {
                    clearInterval(this.update_interval!)
                    this.update_interval = null
                    return
                }

                const u = this.updates.splice(0, this.updates.length)
                const update = mergeUpdates(u)
                const encoded = fromUint8Array(update)
                await ymongo.storeUpdate(this.doc_id, update)
                this.sendToAll(encoded, EventType.Update)

            }, FLUSH_UPDATE_INTERVAL)
        }
    }

    //add client to manager
    addClient(res: Response, client_id: string, name: string, uuid: string) {
        const exists = this.clients.get(client_id)

        if (exists) {
            exists.push(res, uuid)
        } else {
            this.clients.set(client_id, new Client(res, client_id, name, uuid))
        }

        return client_id
    }

    //send to all clients
    sendToAll(data: string, event: EventType) {
        Array.from(this.clients.values()).map((c: Client) => c.send(data, event))
    }

    //send to one client
    async sendTo(client_id: string, data: string, event: EventType) {
        return this.getClient(client_id)?.send(data, event)
    }

    //remove client
    removeClient(client_id: string, uuid: string) {
        const client = this.clients.get(client_id)
        const len = client?.remove(uuid)

        if (client && len && len === 0) {
            client.clearCursor()
            this.clients.delete(client_id)
            this.queuePresence(client)
        }
    }

    //get all cursors
    getCursors() {
        return Array.from(this.clients.values()).map(c => ({ session_id: c.client_id, name: c.name, cursor: c.cursor }))
    }

    //get client by client_id
    getClient(client_id: string) {
        return this.clients.get(client_id)
    }

    //emit presence to all other clients
    queuePresence(c: Client) {
        this.presence_queue.push(c.client_id)

        if (!this.presence_interval) {
            this.presence_interval = setInterval(async () => {
                if (this.presence_queue.length === 0) {
                    clearInterval(this.presence_interval!)
                    this.presence_interval = null
                    return
                }

                const clients = this.presence_queue.splice(0, this.presence_queue.length)
                clients.map(async id => {
                    const c = this.getClient(id)
                    if (c) {
                        const payload = { session_id: c.client_id, name: c.name, cursor: c.cursor }
                        this.sendToAll(JSON.stringify(payload), EventType.Presence)
                    }
                })
            }, FLUSH_PRESENCE_INTERVAL)
        }
    }

    receivePresence(client_id: string) {
        this.getCursors().map((cursor) => this.sendTo(client_id, JSON.stringify(cursor), EventType.Presence))
    }
}