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
import morgan from 'morgan'
import uuid from 'uuid'

const { v4: uuidv4 } = uuid

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
    collectionName: COLLECTION
});

const app: Express = express();

app.use(morgan("dev"))

app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: "secret",
    store: MongoStore.create({
        mongoUrl: mongostr,
        ttl: 60 * 60 // = 1hr
    })
}))

const doesDocumentExist = async (id: string) => {
    const docs: Array<string> = await ymongo.getAllDocNames()
    return docs.includes(id)
}

app.get('/api/connect/:id', async (req: Request, res: Response) => {
    const connid = uuidv4()

    const { id } = req.params

    const { email, password, name } = req.session as any;


    if (!req.sessionID) {
        console.log(`No session found`)
        return res.json({ error: true, message: "ERROR: No session found" });
    }

    const client_id = req.sessionID;

    const log = (value: string) => console.log(`(${connid} ${client_id}): ${value}`)


    //simple auth check
    if (!email || !password) {
        console.log(`ERROR: No email/pass`)
        return res.json({ error: true, message: "Email/password not supplied" });
    }
    log(`Connecting`)

    const doesDocExist = await doesDocumentExist(id)

    if (!doesDocExist) {
        log("ERROR: Document doesnt exist")
        return res.json({ error: true, message: "Document does not exist" })
    }

    const headers = {
        'Content-Type': 'text/event-stream',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        "X-Accel-Buffering": "no"
    };

    res.writeHead(200, headers);

    if (!name) {
        log("ERROR: NO NAME FOUND")
    }

    if (!clients[id]) {
        clients[id] = new ClientManager(id)
    }

    clients[id].addClient(res, client_id, req.session.name!, connid)

    // find document or create it
    const doc: Y.Doc = await ymongo.getYDoc(id)
    const update = Y.encodeStateAsUpdate(doc);

    await Promise.all([clients[id].sendTo(client_id, fromUint8Array(update), EventType.Sync), clients[id].receivePresence(client_id)])

    log("MESSAGES SENT")


    res.on("close", () => {
        log("CLOSED")
        clients[id].removeClient(client_id, connid)
    })
})

app.listen(8000, async () => {
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

    await Promise.all([updatesConsumer, presenceConsumer])
})
