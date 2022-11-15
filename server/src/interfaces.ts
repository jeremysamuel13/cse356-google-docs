import SSE from "express-sse-ts";
import { v4 as uuidv4 } from 'uuid'
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

export class Client {
    client_id: string;
    res: SSE;

    constructor(res: SSE, client_id) {
        this.client_id = client_id
        this.res = res
    }

    send(data: string, event: EventType, exclude?: string) {
        return new Promise<void>((resolve, reject) => {
            if (this.client_id !== exclude) {
                this.res.send(data, event)
                console.log(`${this.client_id}: Data was sent to (exlcuded: ${exclude})`)
            }
            return resolve()
        })
    }
}

export class ClientManager {
    clients: Array<Client>
    constructor() {
        this.clients = []
    }

    addClient(res: SSE, client_id) {
        this.clients.push(new Client(res, client_id))
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
}

