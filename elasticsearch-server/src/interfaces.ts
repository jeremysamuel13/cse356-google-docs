export type Action = "update" | "delete" | "create"

export interface BaseMessage {
    index: string,
    id: string,
    action: Action
}

export interface UpdateMessage extends BaseMessage {
    contents: string,
    // name?: string,
}

export interface CreateMessage extends BaseMessage {
    contents: string,
    name: string
}

export interface DeleteMessage extends BaseMessage {
}

export interface ElasticDoc {
    name: string,
    contents: string
}

export type UpdateElasticDoc = Omit<ElasticDoc, "name">

export interface Update {
    doc: {
        contents: string
    },
    id: string
}
