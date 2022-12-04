import { Response } from 'express'


interface BaseMessage {
    id: string,
    event: EventType,
    to?: string
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
    res: Response;
    cursor: Cursor;
    name: string;

    constructor(res: Response, client_id: string, name: string) {
        this.client_id = client_id
        this.res = res
        this.cursor = {}
        this.name = name;
    }

    send(data: string, event: EventType) {
        return new Promise<void>((resolve, reject) => {
            let str = `event: ${event}\ndata: ${data}\n id: ${this.client_id}\n\n`
            this.res.write(str, (err) => {
                if (err) {
                    return reject(err)
                } else {
                    return resolve()
                }
            })
        })
    }

    setCursor(index: number, length: number) {
        this.cursor = { index, length }
    }

    clearCursor() {
        this.cursor = {}
    }
}

export class ClientManager {
    clients: Map<string, Client>

    constructor() {
        this.clients = new Map()
    }

    //add client to manager
    addClient(res: Response, client_id: string, name: string) {
        this.clients.set(client_id, new Client(res, client_id, name))
        return client_id
    }

    //send to all clients
    async sendToAll(data: string, event: EventType) {
        await Promise.all(Array.from(this.clients.values()).map((c: Client) => c.send(data, event)))
    }

    //send to one client
    async sendTo(client_id: string, data: string, event: EventType) {
        return this.getClient(client_id)?.send(data, event)
    }

    //remove client
    async removeClient(client_id: string) {
        const client = this.clients.get(client_id)
        if (client) {
            client.clearCursor()
            this.clients.delete(client_id)
            await this.emitPresence(client)
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
    async emitPresence(c: Client) {
        //console.log(c)
        //console.log(c.session_id)
        const payload = { session_id: c.client_id, name: c.name, cursor: c.cursor }
        await this.sendToAll(JSON.stringify(payload), EventType.Presence)
        //console.log(`!!!!!!!!!!\nSent presence:\n${payload}\n!!!!!!!!!!`)
    }

    async receivePresence(client_id: string) {
        await Promise.all(this.getCursors().map(async (cursor) => await this.sendTo(client_id, JSON.stringify(cursor), EventType.Presence)))
    }
}