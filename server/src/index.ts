import fs from 'fs'

import dotenv from 'dotenv';

import express, { Express } from 'express';
import cors from 'cors';
import session from 'express-session'
import morgan from 'morgan'

import { MongodbPersistence } from "y-mongodb-provider";

import { connect as mongoConnect } from 'mongoose'

import { Client as ElasticClient } from '@elastic/elasticsearch'
import { createIndicies } from './db/elasticsearch';

import { createTransport } from 'nodemailer'

import users from './routes/users'
import collection from './routes/collections'
import media from './routes/media'
import api from './routes/api'
import index from './routes/index'
import { Clients } from './interfaces';
import path from 'path';

//promises that need to be resolved before server starts
const promises: Promise<any>[] = []

// Allow for interaction with dotenv
dotenv.config();

const { PORT, COLLECTION, DB, DB_USER, DB_PASS, DB_HOST, DB_PORT, SECRET_KEY, ELASTICSEARCH_PASS, DELETE } = process.env;

const mongostr = `mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB}?authSource=admin`
console.log(mongostr)

export const clients = {} as Clients

//MONGO + YJS
// export const ymongo = new MongodbPersistence(mongostr, {
//     collectionName: COLLECTION,
//     flushSize: 50
// });

mongoConnect(mongostr, (val) => console.log(val ?? "connected to docs db"));

//ELASTICSEARCH
export const elastic_client = new ElasticClient({
    node: 'http://localhost:9200',
})

promises.push(createIndicies(DELETE === "true"))

// EXPRESS
const app: Express = express();

//logger
app.use(morgan((tokens, req, res) => {
    return JSON.stringify({
        'remote_address': tokens['remote-addr'](req, res),
        'time': tokens['date'](req, res, 'iso'),
        'method': tokens['method'](req, res),
        'url': tokens['url'](req, res),
        'http_version': tokens['http-version'](req, res),
        'status_code': tokens['status'](req, res),
        'content_length': tokens['res'](req, res, 'content-length'),
        'referrer': tokens['referrer'](req, res),
        'user_agent': tokens['user-agent'](req, res),
        'response_time': tokens['response-time'](req, res)
    })
}, { stream: fs.createWriteStream('./access.log', { flags: 'a' }) }))


//mail 
export const transport = createTransport({
    sendmail: true,
    path: '/usr/sbin/sendmail',
    newline: 'unix'
})

app.set('trust proxy', 1)
app.use(cors({ credentials: true }));

// JSON Middleware
app.use(express.json({ limit: '50mb' }))
// app.use(express.urlencoded({ extended: true }));

//Cookie-based sessions
app.use(session({
    // name: 'mahirjeremy-connect.sid',
    resave: false,
    saveUninitialized: false,
    secret: SECRET_KEY,
    // httpOnly: false,
    // proxy: true,
    // cookie: {
    //     domain: "mahirjeremy.cse356.compas.cs.stonybrook.edu"
    // }
} as any))

//routes
app.use('/users', users)
app.use('/collection', collection)
app.use('/media', media)
app.use('/api', api);
app.use('/index', index);

app.get('/server/logs', async (req, res) => {
    const allFileContents = fs.readFileSync('./access.log', 'utf-8');

    const logMap = new Map<String, { logs: any[] }>();

    allFileContents.split(/\r?\n/).forEach(line => {
        try {
            const data = JSON.parse(line)
            const [_, first, second] = data.url.split('/') as string[]
            let key = ''
            if (first) { key = key + `/${first}` }
            if (first !== "edit" && second) {
                key = key + `/${second.split("?")[0]}`
            }
            if (!logMap.get(key)) { logMap.set(key, { logs: [] }) }
            logMap.get(key)!.logs.push(data)
        } catch {

        }
    });

    return res.json([...logMap.entries()].map(([key, { logs }]) => {
        let times: number[] = []
        let total = 0
        let errors = 0


        logs.forEach(log => {
            const response_time = parseFloat(log.response_time)

            if (parseInt(log.status_code) >= 400) {
                errors = errors + 1
            }

            total = total + response_time
            times.push(response_time)
        })

        times.sort((a, b) => b - a)


        return {
            key, max: times[0], min: times[times.length - 1], requests: logs.length, total_time: total, average: total / logs.length, errors, times: times.slice(0, 10)
        }
    }))
})

//static routes: no auth needed
app.use('/library', express.static("/cse356-google-docs/crdt/dist"))
app.use(express.static("/cse356-google-docs/client/build"))
app.get('/*', (req, res) => {
    if (!res.headersSent) {
        res.setHeader('X-CSE356', '63094ca6047a1139b66d985a')
        res.sendFile('/cse356-google-docs/client/build/index.html')
    }
})

//only start server once all promises are resolved
Promise.all(promises).then(() => {
    app.listen(80, async () => {
        console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
    })
})
