import { Request, Response, NextFunction, Router } from 'express';
import { clients } from '../index'
import SSE from "express-sse-ts";
import { EventType, Event } from '../interfaces'
import * as Y from "yjs";
import { toUint8Array, fromUint8Array } from 'js-base64';
import { doesDocumentExist } from './collections';
import { authMiddleware } from './users';

const router = Router()

export const connect = async (req: Request, res: Response, next: NextFunction) => {

    const { id } = req.params

    const client_id = req.sessionID;

    console.log(`${client_id}: Connecting`)

    if (!(await doesDocumentExist(id))) {
        console.log("Document doesnt exist")
        return res.json({ error: true, message: "Document does not exist" })
    }

    res.setHeader("X-Accel-Buffering", "no")

    const exists = clients[id].clients.getClient(client_id)
    let sse: SSE;
    if (exists) {
        sse = exists.res
    } else {
        sse = new SSE()
        clients[id].clients.addClient(sse, client_id, req.session.name!)
    }

    // find document or create it
    const document: Y.Doc = clients[id].doc
    sse.init(req, res, next)

    console.log(`Started connection with room: ${id}`)

    const update = Y.encodeStateAsUpdate(document);
    const payload = { update: fromUint8Array(update), client_id: client_id, event: EventType.Sync }
    console.log(`${client_id}: Syncing`)

    await Promise.all([clients[id].clients.sendTo(client_id, JSON.stringify(payload), EventType.Sync), clients[id].clients.receivePresence(client_id)])

    req.on("close", async () => {
        await clients[id].clients.removeClient(client_id)
        res.end()
    })
    req.on("finish", async () => {
        await clients[id].clients.removeClient(client_id)
        res.end()
    })
    console.log("Connect success")

}

export const op = async (req: Request<Event>, res: Response) => {
    // we expect a json body
    if (!req.is('application/json')) {
        console.log("Not json")
        return res.json({ error: true, message: "Not json" })
    }

    //console.log("OP CALLED")

    const { id } = req.params as any

    if (!id) {
        console.log("Missing ID")
        return res.json({ error: true, message: "Missing id" })
    }

    res.send({})

    const body: Event = req.body

    //console.log(`${body.client_id}: Sent update`)
    const update = toUint8Array(body.data)
    const payload = { update: body.data, client_id: body.client_id, event: EventType.Update }
    clients[id].updateDocument(update)
    //console.log("Update success")
    await clients[id].clients.sendToAll(JSON.stringify(payload), EventType.Update)

}

export const presence = async (req: Request, res: Response) => {
    if (!req.is('application/json')) {
        console.log("Not json")
        return res.json({ error: true, message: "Not json" })
    }

    const { id } = req.params as any
    const { index, length } = req.body;

    const c = clients[id].clients.getClient(req.sessionID)

    if (!c) {
        return res.json({ error: true, message: "Client session not found" })
    }

    c.setCursor(index, length)
    await clients[id].clients.emitPresence(c)
    console.log(`${c.client_id}: Sent presence`)

    // console.log("Presence success")

    return res.json({ error: false })
}

router.use(authMiddleware)
router.get('/connect/:id', connect);
router.post('/op/:id', op)
router.post('/presence/:id', presence)


export default router;