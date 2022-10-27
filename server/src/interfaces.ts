import SSE from "express-sse-ts";

export enum EventType {
    Sync = "sync",
    Update = "update"
}

export interface Clients {
    [key: string]: SSE[]
}


export interface Event {
    event: EventType,
    data: any
}