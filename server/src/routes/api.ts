import { Request, Response, NextFunction, Router } from 'express';
import { sse_amqp_channel, SSE_QUEUE_NAME, ymongo } from '../index'
import { EventType, Event, ClientManager } from '../interfaces'
import * as Y from "yjs";
import { toUint8Array, fromUint8Array } from 'js-base64';
import { doesDocumentExist } from './collections';
import { authMiddleware } from './users';
import { updateDocument } from "../db/elasticsearch";


const router = Router()

// export const connect = async (req: Request, res: Response, next: NextFunction) => {

//     const { id } = req.params

//     const client_id = req.sessionID;

//     console.log(`${client_id}: Connecting`)

//     if (!await doesDocumentExist(id)) {
//         console.log("Document doesnt exist")
//         return res.json({ error: true, message: "Document does not exist" })
//     }


//     const headers = {
//         'Content-Type': 'text/event-stream',
//         'Connection': 'keep-alive',
//         'Cache-Control': 'no-cache',
//         "X-Accel-Buffering": "no"
//     };
//     res.set(headers)
//     res.flushHeaders();


//     if (!clients[id]) {
//         clients[id] = new ClientManager()
//     }

//     clients[id].addClient(res, client_id, req.session.name!)


//     // find document or create it
//     const doc: Y.Doc = await ymongo.getYDoc(id)
//     const update = Y.encodeStateAsUpdate(doc);
//     const payload = { update: fromUint8Array(update), client_id: client_id, event: EventType.Sync }

//     await Promise.all([clients[id].sendTo(client_id, JSON.stringify(payload), EventType.Sync), clients[id].receivePresence(client_id)])

//     res.on("close", async () => {
//         await clients[id].removeClient(client_id)
//     })
// }

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

    //console.log(`${body.client_id}: Sent update`)
    const update = toUint8Array(body.data)
    const payload = { update: body.data, client_id: body.client_id, event: EventType.Update }

    const message = {
        id,
        event: 'update',
        payload: JSON.stringify(payload)
    }

    sse_amqp_channel.sendToQueue(SSE_QUEUE_NAME!, Buffer.from(JSON.stringify(message)))
    await ymongo.storeUpdate(id, update)
    await updateDocument(id)
    return res.json({ error: false })

}

export const presence = async (req: Request, res: Response) => {
    if (!req.is('application/json')) {
        console.log("Not json")
        return res.json({ error: true, message: "Not json" })
    }

    const { id } = req.params as any
    const { index, length } = req.body;


    const cursor = { index, length }
    const message = {
        id,
        event: 'presence',
        cursor,
        session_id: req.sessionID,
        name: req.session.name
    }

    sse_amqp_channel.sendToQueue(SSE_QUEUE_NAME!, Buffer.from(JSON.stringify(message)))

    return res.json({ error: false })
}

router.use(authMiddleware)
// router.get('/connect/:id', connect);
router.post('/op/:id', op)
router.post('/presence/:id', presence)


export default router;