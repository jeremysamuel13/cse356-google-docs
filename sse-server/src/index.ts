import * as dotenv from 'dotenv'
import { connect, ConsumeMessage } from 'amqplib'
import { BroadcastMessage, EventType, OpMessage, PresenceMessage } from './interface'
import express, { Express, Request, Response } from 'express'
import { MongodbPersistence } from 'y-mongodb-provider'
import { Clients, ClientManager } from './interface'
import * as Y from 'yjs'
import { fromUint8Array } from 'js-base64'
import { default as MongoStore } from 'connect-mongo'
import session from 'express-session'

declare module 'express-session' {
    interface SessionData {
        email: string;
        password: string;
        name: string;
    }
}

dotenv.config()

export const { PORT, COLLECTION, DB, DB_USER, DB_PASS, DB_HOST, DB_PORT, SECRET_KEY, AMQP_URL, QUEUE_NAME } = process.env;
const mongostr = `mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB}?authSource=admin`

const clients = {} as Clients

//MONGO + YJS
export const ymongo = new MongodbPersistence(mongostr, {
    collectionName: COLLECTION,
    flushSize: 25
});

const app: Express = express();

app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: SECRET_KEY!,
    store: MongoStore.create({
        mongoUrl: mongostr,
        autoRemove: 'interval',
        autoRemoveInterval: 1,
        ttl: 60 * 60 // = 1hr
    })
}))

const conn = await connect(AMQP_URL!)
const channel = await conn.createChannel()
await channel.assertQueue(QUEUE_NAME!)
channel.prefetch(10)

const updatesConsumer = channel.consume(QUEUE_NAME!, async (msg: ConsumeMessage | null) => {
    if (!msg) {
        return
    }

    //BROADCAST MESSAGE
    const decoded: BroadcastMessage = JSON.parse(msg.content.toString())

    switch (decoded.event) {
        case 'update':
            const opmessage = decoded as OpMessage
            await clients[opmessage.id].sendToAll(opmessage.payload, EventType.Update)
            break;
        case 'presence':
            const presencemessage = decoded as PresenceMessage
            const cl = clients[presencemessage.id]?.getClient(presencemessage.session_id)
            cl?.setCursor(presencemessage.cursor.index, presencemessage.cursor.length)
            await clients[presencemessage.id].emitPresence(cl!)
            break;
        default:
            console.error("INVALID EVENT TYPE")
            break;
    }
}, { noAck: true })

const doesDocumentExist = async (id: string) => {
    const docs: Array<string> = await ymongo.getAllDocNames()
    return docs.includes(id)
}


app.get('/api/connect/:id', async (req: Request, res: Response) => {
    const { id } = req.params

    const { email, password } = req.session as any;

    //simple auth check
    if (!email || !password) {
        console.log(`Middleware (${req.sessionID}): No email/pass`)
        return res.json({ error: true, message: "Email/password not supplied" });
    }

    const client_id = req.sessionID;

    console.log(`${client_id}: Connecting`)

    if (!await doesDocumentExist(id)) {
        console.log("Document doesnt exist")
        return res.json({ error: true, message: "Document does not exist" })
    }

    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        "X-Accel-Buffering": "no"
    };
    res.set(headers)
    res.flushHeaders();


    if (!clients[id]) {
        clients[id] = new ClientManager()
    }

    clients[id].addClient(res, client_id, req.session.name!)

    // find document or create it
    const doc: Y.Doc = await ymongo.getYDoc(id)
    const update = Y.encodeStateAsUpdate(doc);
    const payload = { update: fromUint8Array(update), client_id: client_id, event: EventType.Sync }

    await Promise.all([clients[id].sendTo(client_id, JSON.stringify(payload), EventType.Sync), clients[id].receivePresence(client_id)])

    res.on("close", async () => {
        await clients[id].removeClient(client_id)
    })
})

app.listen(8000, async () => {
    await updatesConsumer
})
