import { Request, Response, NextFunction, Router } from 'express';
import { clients } from '../index'
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

    if (!doesDocumentExist(id)) {
        console.log("Document doesnt exist")
        return res.json({ error: true, message: "Document does not exist" })
    }

    res.setHeader("X-Accel-Buffering", "no")

    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache'
    };
    res.writeHead(200, headers);

    clients[id].clients.addClient(res, client_id, req.session.name!)


    // find document or create it
    const doc = clients[id]

    console.log(`Started connection with room: ${id}`)

    const update = Y.encodeStateAsUpdate(doc.doc);
    const payload = { update: fromUint8Array(update), client_id: client_id, event: EventType.Sync }
    console.log(`${client_id}: Syncing`)


    await Promise.all([doc.clients.sendTo(client_id, JSON.stringify(payload), EventType.Sync), doc.clients.receivePresence(client_id)])

    res.on("close", async () => await doc.clients.removeClient(client_id))
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

    const body: Event = req.body

    const doc = clients[id]

    //console.log(`${body.client_id}: Sent update`)
    const update = toUint8Array(body.data)
    const payload = { update: body.data, client_id: body.client_id, event: EventType.Update }
    doc.updateDocument(update)
    //console.log("Update success")
    await doc.clients.sendToAll(JSON.stringify(payload), EventType.Update)
    return res.json({ error: false })

}

export const presence = async (req: Request, res: Response) => {
    if (!req.is('application/json')) {
        console.log("Not json")
        return res.json({ error: true, message: "Not json" })
    }

    const { id } = req.params as any
    const { index, length } = req.body;

    const doc = clients[id]

    const c = doc.clients.getClient(req.sessionID)

    if (!c) {
        console.error(`ATTEMPTED TO SEND PRESENCE OF NON-EXISTENT CLIENT: ${req.sessionID}`)
        return res.json({ error: true, message: "Client session not found" })
    }

    c.setCursor(index, length)
    await doc.clients.emitPresence(c)

    return res.json({ error: false })
}

router.use(authMiddleware)
router.get('/connect/:id', connect);
router.post('/op/:id', op)
router.post('/presence/:id', presence)


export default router;