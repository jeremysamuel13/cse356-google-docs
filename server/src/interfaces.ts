import SSE from "express-sse-ts";
import { Types, Document } from "mongoose";
import { v4 as uuidv4 } from 'uuid'
import { IAccount } from "./db/userSchema";
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

type AccountType = (Document<unknown, any, IAccount> & IAccount & {
    _id: Types.ObjectId;
})
export class Client {
    client_id: string;
    res: SSE;
    cursor: Cursor;
    account: AccountType;

    constructor(res: SSE, client_id, account) {
        this.client_id = client_id
        this.res = res
        this.cursor = {}
        this.account = account;
    }

    send(data: string, event: EventType, exclude?: string) {
        return new Promise<void>((resolve, reject) => {
            if (this.client_id !== exclude) {
                this.res.send(data, event)
                console.log(`${this.client_id}: Data was sent (excluded: ${exclude})`)
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
    clients: Array<Client>
    constructor() {
        this.clients = []
    }

    addClient(res: SSE, client_id, account) {
        this.clients.push(new Client(res, client_id, account))
        return client_id
    }

    async sendToAll(data: string, event: EventType, exclude?: string) {
        await Promise.all(this.clients.map(c => c.send(data, event, exclude)))
    }

    async sendTo(client_id: string, data: string, event: EventType, exclude?: string) {
        await this.clients.find(c => c.client_id === client_id)?.send(data, event, exclude)
    }

    removeClient(client_id: string, f: any) {
        this.clients = this.clients.filter(c => c.client_id !== client_id)
        console.log(`${client_id}: Disconnected`)
        if (f) {
            f()
        }
    }

    getCursors() {
        return this.clients.map(c => ({ session_id: c.client_id, name: c.account?.username, cursor: c.cursor }))
    }

    getClient(client_id: string) {
        return this.clients.find(c => c.client_id === client_id)
    }

    async emitPresence(client_id) {
        const c = this.getClient(client_id) as Client
        const payload = { session_id: c.client_id, name: c.account?.username, cursor: c.cursor }
        await this.sendToAll(JSON.stringify(payload), EventType.Presence, client_id)
        console.log(`!!!!!!!!!!\nSent presence:\n${payload}\n!!!!!!!!!!`)
    }
}

