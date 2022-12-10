import { Request, Response, Router } from 'express';
import { sse_amqp_channel, SSE_PRESENCE_QUEUE_NAME, SSE_UPDATE_QUEUE_NAME, ymongo } from '../index'
import { authMiddleware } from './users';
import { updateDocument } from "../db/elasticsearch";


const router = Router()

export const op = async (req: Request<Event>, res: Response) => {
    // we expect a json body
    if (!req.is('application/json')) {
        console.log({ headers: req.headers, body: req.body })
        console.log("Not json")
        return res.json({ error: true, message: "Not json" })
    }

    const { id } = req.params as any

    if (!id) {
        console.log("Missing ID")
        return res.json({ error: true, message: "Missing id" })
    }

    const message = {
        id,
        payload: req.body.data
    }

    res.json({ error: false })

    sse_amqp_channel.sendToQueue(SSE_UPDATE_QUEUE_NAME!, Buffer.from(JSON.stringify(message)))
    updateDocument(id)

    return
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
        cursor,
        session_id: req.sessionID,
        name: req.session.name
    }

    sse_amqp_channel.sendToQueue(SSE_PRESENCE_QUEUE_NAME!, Buffer.from(JSON.stringify(message)))

    return res.json({ error: false })
}

router.use(authMiddleware)
router.post('/op/:id', op)
router.post('/presence/:id', presence)


export default router;