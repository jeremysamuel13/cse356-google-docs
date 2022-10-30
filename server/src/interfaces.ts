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
        if (this.client_id !== exclude) {
            this.res.send(data, event)
        }
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
        return client
    }

    sendToAll(data: string, event: EventType, exclude?: string) {
        this.clients.forEach(c => c.send(data, event, exclude))
    }
}

