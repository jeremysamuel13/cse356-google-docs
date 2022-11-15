import { Request, Response, NextFunction } from 'express';
import { clients, ymongo } from '../index'
import SSE from "express-sse-ts";
import { EventType, ClientManager, Event } from '../interfaces'
import * as Y from "yjs";
import { toUint8Array, fromUint8Array } from 'js-base64';
import { doesDocumentExist } from './collections';

export const connect = async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params

    if (!await doesDocumentExist(ymongo, id)) {
        return res.json({ error: true, message: "Document does not exist" })
    }

    res.setHeader("Cache-Control", "no-cache, no-transform");

    console.log(`Started connection with room: ${id}`)

    // find document or create it
    const document: Y.Doc = await ymongo.getYDoc(id)

    const sse = new SSE()
    sse.init(req, res, next)
    if (!clients[id]) {
        clients[id] = new ClientManager()
    }

    const client_id = req.session?.id
    clients[id].addClient(sse, client_id)
    const update = Y.encodeStateAsUpdate(document);
    const payload = { update: fromUint8Array(update), client_id: client_id, event: EventType.Sync }
    console.log(`${client_id}: Syncing`)
    clients[id].sendTo(client_id, JSON.stringify(payload), EventType.Sync)
    req.on("close", () => {
        clients[id].removeClient(client_id, async () => {
            await ymongo.flushDocument(id)
        })
    })
}

export const op = async (req: Request<Event>, res: Response) => {
    const start = performance.now()

    // we expect a json body
    if (!req.is('application/json')) {
        console.log("Not json")
        return res.sendStatus(400)
    }

    const { id } = req.params as any
    const body: Event = req.body
    const document: Y.Doc = await ymongo.getYDoc(id)

    const onUpdate = async (update: Uint8Array) => {
        await ymongo.storeUpdate(id, update);
    }

    document.on('update', onUpdate)

    if (body.event === EventType.Update) {
        console.log(`${body.client_id}: Sent update`)
        //const state = Y.encodeStateVector(document)
        const update = toUint8Array(body.data)
        Y.applyUpdate(document, update)
        //const computedUpdate = Y.encodeStateAsUpdate(document, state)
        const payload = { update: fromUint8Array(update), client_id: body.client_id, event: EventType.Update }
        console.log(`${body.client_id}: Sending update to others`)
        document.emit('update', [update])
        await clients[id].sendToAll(JSON.stringify(payload), EventType.Update, body.client_id).then(() => {
            console.log(`!!!!!!!!!!\nSent text:\n${document.getText().toJSON()}\n!!!!!!!!!!`)
        })
    }

    document.off('update', onUpdate)
    const elapsed = performance.now() - start
    console.log(`${body.client_id}: OP took ${elapsed}ms`)
    return res.sendStatus(200)
}

export const presence = async (req: Request, res: Response) => {
    if (!req.is('application/json')) {
        console.log("Not json")
        return res.sendStatus(400)
    }

    const { id } = req.params as any
    const { index, length } = req.body;
    const { account } = req as any

    const client_id = req.session?.id;

    console.log(`${client_id}: Sent presence`)

    const payload = {
        session_id: client_id,
        name: account.username,
        cursor: {
            index,
            length
        }

    }

    await clients[id].sendToAll(JSON.stringify(payload), EventType.Presence, client_id).then(() => {
        console.log(`!!!!!!!!!!\nSent presence:\n${{ index, length }}\n!!!!!!!!!!`)
    })

    return res.sendStatus(200)

}