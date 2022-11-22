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

import path from 'path';

import users from './routes/users'
import collection from './routes/collections'
import media from './routes/media'
import api from './routes/api'
import index from './routes/index'
import { Clients } from './interfaces';

//promises that need to be resolved before server starts
const promises: Promise<any>[] = []

// Allow for interaction with dotenv
dotenv.config();

const { PORT, COLLECTION, DB, DB_USER, DB_PASS, DB_HOST, DB_PORT, SECRET_KEY, ELASTICSEARCH_PASS, DELETE } = process.env;

const mongostr = `mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB}?authSource=admin`
console.log(mongostr)

export const clients = {} as Clients

//MONGO + YJS
export const ymongo = new MongodbPersistence(mongostr, {
    collectionName: COLLECTION,
    flushSize: 50
});

mongoConnect(mongostr, (val) => console.log(val ?? "connected to docs db"));

//ELASTICSEARCH
export const elastic_client = new ElasticClient({
    node: 'https://localhost:9200',
    auth: {
        username: 'elastic',
        password: ELASTICSEARCH_PASS as string
    },
    tls: {
        ca: fs.readFileSync('/root/http_ca.crt'),
        rejectUnauthorized: false
    }
})

promises.push(createIndicies(DELETE === "true"))

// EXPRESS
const app: Express = express();

//logger
// app.use(morgan("dev"))

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

//static routes: no auth needed
// app.use('/library', express.static("/cse356-google-docs/crdt/dist"))
// app.get('/*', express.static("/cse356-google-docs/client/build"), (_, res) => {
//     res.sendFile("/cse356-google-docs/client/build/index.html")
// })

//only start server once all promises are resolved
Promise.all(promises).then(() => {
    app.listen(PORT, async () => {
        console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
    })
})
