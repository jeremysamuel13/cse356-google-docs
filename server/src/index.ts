import express, { Express, Request, Response, NextFunction } from 'express';
import { EventType, Clients, Event } from './interfaces'
import dotenv from 'dotenv';
import * as Y from "yjs";
import SSE from "express-sse-ts";
import { MongodbPersistence } from "y-mongodb-provider";

// Allow for interaction with dotenv
dotenv.config();

const { PORT, COLLECTION, DB, DB_USER, DB_PASS, DB_HOST, DB_PORT } = process.env;

const app: Express = express();

// console.log(`mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB}?authMechanism=DEFAULT`)
const mongostr = "mongodb://127.0.0.1:27017/docs"

const ymongo = new MongodbPersistence(mongostr, {
    collectionName: COLLECTION
});

const clients = {} as Clients

// JSON Middleware
app.use(express.json())

const log = console.log

// Set Header
app.use((_, res, next) => {
    res.setHeader("X-CSE356", "63094ca6047a1139b66d985a")
    next()
})

app.get('/connect/:id', async (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params

    log(`Started connection with room: ${id}`)

    // find document or create it
    const document: Y.Doc = await ymongo.getYDoc(id)

    const sse = new SSE()
    clients[id] = clients[id] ? [...clients[id], sse] : [sse]
    sse.init(req, res, next)
    // @ts-ignore
    sse.send(Y.encodeStateVector(document), EventType.Sync)
});

app.get('/doc/:id', async (req: Request, res: Response) => {
    const { id } = req.params

    // find document or create it
    const document: Y.Doc = await ymongo.getYDoc(id)

    return res.send(Y.encodeStateVector(document))
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

    if (body.event === EventType.Update) {
        document.on('update', async update => {
            ymongo.storeUpdate(id, update);
            clients[id]?.forEach(sse => sse.send(update, EventType.Update))
        })

        const stateVector = body.data
        const diff = Y.encodeStateAsUpdate(document, stateVector)
        Y.applyUpdate(document, diff)
        document.emit('update', [diff])
    }

    return res.sendStatus(200)
})

app.listen(PORT, async () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
});