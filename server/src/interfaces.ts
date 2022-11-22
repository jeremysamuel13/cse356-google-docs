import SSE from "express-sse-ts";
import { applyUpdate, Doc } from "yjs";
import { ymongo } from "./index";
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

export interface Cursor {
    index?: number
    length?: number
}

export class Client {
    client_id: string;
    res: SSE;
    cursor: Cursor;
    name: string;

    constructor(res: SSE, client_id: string, name: string) {
        this.client_id = client_id
        this.res = res
        this.cursor = {}
        this.name = name;
    }

    send(data: string, event: EventType, exclude?: string) {
        return new Promise<void>((resolve, reject) => {
            if (this.client_id !== exclude) {
                this.res.send(data, event, this.client_id)
                //console.log(`${this.client_id}: Data was sent (excluded: ${exclude})`)
            }
            return resolve()
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
    addClient(res: SSE, client_id: string, name: string) {
        this.clients.set(client_id, new Client(res, client_id, name))
        return client_id
    }

    //send to all clients
    async sendToAll(data: string, event: EventType, exclude?: string) {
        await Promise.all(Array.from(this.clients.values()).map((c: Client) => c.send(data, event, exclude)))
    }

    //send to one client
    async sendTo(client_id: string, data: string, event: EventType, exclude?: string) {
        await this.getClient(client_id)?.send(data, event, exclude)
    }

    //remove client
    async removeClient(client_id: string, f?: any) {
        const client = this.clients.get(client_id)
        if (client) {
            client.clearCursor()
            await this.emitPresence(client)
            this.clients.delete(client_id)
        }
        console.log(`${client_id}: Disconnected (hide cursor)`)
        if (f) {
            f()
        }
    }

    //get all cursors
    getCursors() {
        return Array.from(this.clients.values()).map(c => ({ client_id: c.client_id, name: c.name, cursor: c.cursor }))
    }

    //get client by client_id
    getClient(client_id: string) {
        return this.clients.get(client_id)
    }

    //get clients by session_id
    // getClientsBySession(session_id: string) {
    //     return Array.from(this.clients.values()).filter(c => c.session_id === session_id)
    // }

    //emit presence to all other clients
    async emitPresence(c: Client) {
        //console.log(c)
        //console.log(c.session_id)
        const payload = { client_id: c.client_id, name: c.name, cursor: c.cursor }
        await this.sendToAll(JSON.stringify(payload), EventType.Presence)
        //console.log(`!!!!!!!!!!\nSent presence:\n${payload}\n!!!!!!!!!!`)
    }

    async receivePresence(client_id: string) {
        await Promise.all(this.getCursors().map(async (cursor) => await this.sendTo(client_id, JSON.stringify(cursor), EventType.Presence)))
    }
}

