import { Request, Response, NextFunction, Router } from 'express';
import { ymongo } from '../index'
import { Clients } from '../interfaces'
import SSE from "express-sse-ts";
import { EventType, ClientManager, Event } from '../interfaces'
import * as Y from "yjs";
import { toUint8Array, fromUint8Array } from 'js-base64';
import { doesDocumentExist } from './collections';
import { authMiddleware } from './users';
import { v4 as uuidv4 } from 'uuid'
import { updateDocument } from '../db/elasticsearch';

const router = Router()

export const clients = {} as Clients

export const connect = async (req: Request, res: Response, next: NextFunction) => {
    const client_id = uuidv4()

    console.log(`${client_id}: Connecting`)

    const { id } = req.params

    if (!(await doesDocumentExist(ymongo, id))) {
        console.log("Document doesnt exist")
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

    const session_id = req.sessionID;

    clients[id].addClient(sse, client_id, session_id, res.locals.account)
    const update = Y.encodeStateAsUpdate(document);
    const payload = { update: fromUint8Array(update), client_id: client_id, event: EventType.Sync }
    console.log(`${client_id}: Syncing`)

    await Promise.all([clients[id].sendTo(client_id, JSON.stringify(payload), EventType.Sync), clients[id].receivePresence(client_id)])

    req.on("close", () => {
        clients[id].removeClient(client_id)
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

    if (body.event === EventType.Update) {
        //console.log(`${body.client_id}: Sent update`)
        const update = toUint8Array(body.data)
        Y.logUpdate(update)
        const payload = { update: body.data, client_id: body.client_id, event: EventType.Update }
        await Promise.all([ymongo.storeUpdate(id, update), clients[id].sendToAll(JSON.stringify(payload), EventType.Update, body.client_id)])
        updateDocument(id)
        //console.log("Update success")
        return res.json({ error: false })
    }

    return res.json({ error: true, message: "Invalid event type" })
}

export const presence = async (req: Request, res: Response) => {
    if (!req.is('application/json')) {
        console.log("Not json")
        return res.json({ error: true, message: "Not json" })
    }

    const { id } = req.params as any
    const { index, length } = req.body;

    // TODO: PROBLEMATIC. TRY TO GUARANTEE UNIQUE SESSION INSTEAD.
    const client = clients[id].getClientsBySession(req.sessionID)
    await Promise.all(client.map(async c => {
        c.setCursor(index, length)
        await clients[id].emitPresence(c)
        console.log(`${c.client_id}: Sent presence`)
    }))

    console.log("Presence success")

    return res.json({ error: false })
}

router.use(authMiddleware)
router.get('/connect/:id', connect);
router.post('/op/:id', op)
router.post('/presence/:id', presence)


export default router;