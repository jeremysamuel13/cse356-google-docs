import express, { Express, Request, Response, NextFunction } from 'express';
import { EventType, Clients, Event, ClientManager } from './interfaces'
import dotenv from 'dotenv';
import * as Y from "yjs";
import SSE from "express-sse-ts";
import { MongodbPersistence } from "y-mongodb-provider";
import cors from 'cors';
import { toUint8Array, fromUint8Array } from 'js-base64';
import morgan from 'morgan'

// Allow for interaction with dotenv
dotenv.config();

const { PORT, COLLECTION, DB, DB_USER, DB_PASS, DB_HOST, DB_PORT } = process.env;

const app: Express = express();
app.use(cors());

const mongostr = `mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB}?authSource=admin`

const ymongo = new MongodbPersistence(mongostr, {
    collectionName: COLLECTION
});

const clients = {} as Clients

// JSON Middleware
app.use(express.json({ limit: '50mb' }))

//logger
//app.use(morgan("tiny"))


app.get('/connect/:id', async (req: Request, res: Response, next: NextFunction) => {

    const { id } = req.params

    res.setHeader("Cache-Control", "no-cache, no-transform");

    console.log(`Started connection with room: ${id}`)

    // find document or create it
    const document: Y.Doc = await ymongo.getYDoc(id)

    const sse = new SSE()
    sse.init(req, res, next)
    if (!clients[id]) {
        clients[id] = new ClientManager()
    }
    const client_id = clients[id].addClient(sse)
    const update = Y.encodeStateAsUpdate(document);
    const payload = { update: fromUint8Array(update), client_id: client_id, event: EventType.Sync }
    console.log(`${client_id}: Syncing`)
    clients[id].sendTo(client_id, JSON.stringify(payload), EventType.Sync)
    req.on("close", () => {
        clients[id].removeClient(client_id)
    })
});

app.post('/op/:id', async (req: Request, res: Response) => {
    const start = performance.now()

    // we expect a json body
    if (!req.is('application/json')) {
        console.log("Not json")
        return res.sendStatus(400)
    }

    const { id } = req.params
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
})

app.listen(PORT, async () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
});
