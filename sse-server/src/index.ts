import * as dotenv from 'dotenv'
import { connect, ConsumeMessage } from 'amqplib'
import { EventType, OpMessage, PresenceMessage } from './interface'
import express, { Express, Request, Response } from 'express'
import { MongodbPersistence } from 'y-mongodb-provider'
import { Clients, ClientManager } from './interface'
import * as Y from 'yjs'
import { fromUint8Array, toUint8Array } from 'js-base64'
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

export const { PORT, COLLECTION, DB, DB_USER, DB_PASS, DB_HOST, DB_PORT, SECRET_KEY, AMQP_URL, UPDATE_QUEUE_NAME, PRESENCE_QUEUE_NAME } = process.env;
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
const update_channel = await conn.createChannel()
const presence_channel = await conn.createChannel()
await update_channel.assertQueue(UPDATE_QUEUE_NAME!)
await presence_channel.assertQueue(PRESENCE_QUEUE_NAME!)

update_channel.prefetch(20, true)
presence_channel.prefetch(20, true)

const updatesConsumer = update_channel.consume(UPDATE_QUEUE_NAME!, (msg: ConsumeMessage | null) => {
    if (!msg) {
        return
    }

    //BROADCAST MESSAGE
    const opmessage: OpMessage = JSON.parse(msg.content.toString())

    clients[opmessage.id]?.queueUpdate(toUint8Array(opmessage.payload))
}, { noAck: true })

const presenceConsumer = presence_channel.consume(PRESENCE_QUEUE_NAME!, (msg: ConsumeMessage | null) => {
    if (!msg) {
        return
    }

    //BROADCAST MESSAGE
    const presencemessage: PresenceMessage = JSON.parse(msg.content.toString())
    const cl = clients[presencemessage.id]?.getClient(presencemessage.session_id)
    if (cl) {
        cl.setCursor(presencemessage.cursor.index, presencemessage.cursor.length)
        clients[presencemessage.id].queuePresence(cl)
    } else {
        console.error(`Client (${presencemessage.id}) does not exist`)
    }
}, { noAck: true })

const doesDocumentExist = async (id: string) => {
    const docs: Array<string> = await ymongo.getAllDocNames()
    console.log(`${id} in ${docs}`)
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

    console.log("Headers set")


    if (!clients[id]) {
        clients[id] = new ClientManager(id)
    }

    console.log("Client manager created")

    clients[id].addClient(res, client_id, req.session.name!)

    // find document or create it
    const doc: Y.Doc = await ymongo.getYDoc(id)
    const update = Y.encodeStateVector(doc);

    console.log("Doc found")

    await clients[id].sendTo(client_id, fromUint8Array(update), EventType.Sync)

    console.log("Synced")

    await clients[id].receivePresence(client_id)

    console.log("Presence sent")

    // await Promise.all([clients[id].sendTo(client_id, fromUint8Array(update), EventType.Sync), clients[id].receivePresence(client_id)])

    res.on("close", () => {
        console.log("Connection closed")
        clients[id].removeClient(client_id)
    })
})

app.listen(8000, async () => {
    await Promise.all([presenceConsumer, updatesConsumer])
})
