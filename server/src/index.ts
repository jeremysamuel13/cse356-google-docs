import express, { Express, Request, Response, NextFunction } from 'express';
import { EventType, Clients, Event, ClientManager } from './interfaces'
import dotenv from 'dotenv';
import * as Y from "yjs";
import SSE from "express-sse-ts";
import { MongodbPersistence } from "y-mongodb-provider";
import cors from 'cors';
import { JSONToU8A, U8AToJSON } from './utils';
import morgan from 'morgan'


// Allow for interaction with dotenv
dotenv.config();

const { PORT, COLLECTION, DB, DB_USER, DB_PASS, DB_HOST, DB_PORT } = process.env;

const app: Express = express();
app.use(cors());

// console.log(`mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB}?authMechanism=DEFAULT`)
const mongostr = "mongodb://127.0.0.1:27017/docs"

const ymongo = new MongodbPersistence(mongostr, {
    collectionName: COLLECTION
});

const clients = {} as Clients

// JSON Middleware
app.use(express.json())

//logger
app.use(morgan("combined"))

// Set Header
app.use((_, res, next) => {
    res.setHeader("X-CSE356", "63094ca6047a1139b66d985a")
    next()
})

const log = console.log


app.get('/connect/:id', async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params

    log(`Started connection with room: ${id}`)

    // find document or create it
    const document: Y.Doc = await ymongo.getYDoc(id)

    const sse = new SSE()
    if (!clients[id]) {
        clients[id] = new ClientManager()
    }
    const client = clients[id].addClient(sse)
    sse.init(req, res, next)
    const update = Y.encodeStateAsUpdate(document);
    const payload = { update: U8AToJSON(update), client_id: client.client_id }
    client.send(JSON.stringify(payload), EventType.Sync)
});

app.post('/op/:id', async (req: Request, res: Response) => {
    // we expect a json body
    if (!req.is('application/json')) {
        log("Not json")
        return res.sendStatus(400)
    }

    const { id } = req.params
    const body: Event = req.body
    const document: Y.Doc = await ymongo.getYDoc(id)

    const onUpdate = async (update: Uint8Array) => {
        ymongo.storeUpdate(id, update);
    }

    document.on('update', onUpdate)

    if (body.event === EventType.Update) {
        const update = JSONToU8A(body.data)
        Y.applyUpdate(document, update)
        const payload = { update: body.data, client_id: body.client_id }
        clients[id].sendToAll(JSON.stringify(payload), EventType.Update, body.client_id)
        document.emit('update', [update])
    }

    document.off('update', onUpdate)

    return res.sendStatus(200)
})

app.listen(PORT, async () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
});