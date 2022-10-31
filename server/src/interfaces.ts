import SSE from "express-sse-ts";
import { v4 as uuidv4 } from 'uuid'
export enum EventType {
    Sync = "sync",
    Update = "update"
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

    constructor(res: SSE) {
        this.client_id = uuidv4()
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

    addClient(res: SSE) {
        const client = new Client(res)
        this.clients.push(client)
        return client.client_id
    }

    async sendToAll(data: string, event: EventType, exclude?: string) {
        await Promise.all(this.clients.map(c => c.send(data, event, exclude)))
    }

    async sendTo(client_id: string, data: string, event: EventType, exclude?: string) {
        await this.clients.find(c => c.client_id === client_id)?.send(data, event, exclude)
    }

    removeClient(client_id: string) {
        this.clients = this.clients.filter(c => c.client_id !== client_id)
        console.log(`${client_id}: Disconnected`)
    }
}

