import { Request, Response, NextFunction, Router } from 'express';
import { ymongo, clients } from '../index'
import SSE from "express-sse-ts";
import { EventType, ClientManager, Event } from '../interfaces'
import * as Y from "yjs";
import { toUint8Array, fromUint8Array } from 'js-base64';
import { doesDocumentExist } from './collections';
import { authMiddleware } from './users';
import { updateDocument } from '../db/elasticsearch';

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

    const exists = clients[id]?.getClient(client_id)
    let sse: SSE;
    if (exists) {
        sse = exists.res
    } else {
        sse = new SSE()
        if (!clients[id]) {
            clients[id] = new ClientManager()
        }
        clients[id].addClient(sse, client_id, req.session.name!)
    }

    // find document or create it
    const document: Y.Doc = await ymongo.getYDoc(id)
    sse.init(req, res, next)

    console.log(`Started connection with room: ${id}`)

    const update = Y.encodeStateAsUpdate(document);
    const payload = { update: fromUint8Array(update), client_id: client_id, event: EventType.Sync }
    console.log(`${client_id}: Syncing`)

    await Promise.all([clients[id].sendTo(client_id, JSON.stringify(payload), EventType.Sync), clients[id].receivePresence(client_id)])

    req.on("close", async () => {
        await clients[id].removeClient(client_id)
        res.end()
    })
    req.on("finish", async () => {
        await clients[id].removeClient(client_id)
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
    const body: Event = req.body

    //console.log(`${body.client_id}: Sent update`)
    const update = toUint8Array(body.data)
    const payload = { update: body.data, client_id: body.client_id, event: EventType.Update }
    const promises = [ymongo.storeUpdate(id, update), updateDocument(id), clients[id].sendToAll(JSON.stringify(payload), EventType.Update)]
    await Promise.all(promises)
    //console.log("Update success")
    return res.json({ error: false })

}

export const presence = async (req: Request, res: Response) => {
    if (!req.is('application/json')) {
        console.log("Not json")
        return res.json({ error: true, message: "Not json" })
    }

    const { id } = req.params as any
    const { index, length } = req.body;

    const c = clients[id].getClient(req.sessionID)

    if (!c) {
        return res.json({ error: true, message: "Client session not found" })
    }

    c.setCursor(index, length)
    await clients[id].emitPresence(c)
    console.log(`${c.client_id}: Sent presence`)

    console.log("Presence success")

    return res.json({ error: false })
}

router.use(authMiddleware)
router.get('/connect/:id', connect);
router.post('/op/:id', op)
router.post('/presence/:id', presence)


export default router;