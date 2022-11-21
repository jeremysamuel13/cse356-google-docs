import express, { Express } from 'express';
import dotenv from 'dotenv';
import { MongodbPersistence } from "y-mongodb-provider";
import cors from 'cors';
import morgan from 'morgan'
import session from 'express-session'

import { connect as mongoConnect } from 'mongoose'
import MongoStore from 'connect-mongo'

import { Client, Client as ElasticClient } from '@elastic/elasticsearch'

import users from './routes/users'
import collection from './routes/collections'
import media from './routes/media'
import api from './routes/api'
import index from './routes/index'

import fs from 'fs'

// Allow for interaction with dotenv
dotenv.config();

const { PORT, COLLECTION, DB, DB_USER, DB_PASS, DB_HOST, DB_PORT, SECRET_KEY, ELASTICSEARCH_PASS } = process.env;

const app: Express = express();
app.set('trust proxy', 1)
app.use(cors({
    credentials: true
}));

const mongostr = `mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB}?authSource=admin`

console.log(mongostr)

//MONGO + YJS
export const ymongo = new MongodbPersistence(mongostr, {
    collectionName: COLLECTION
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

// EXPRESS
// JSON Middleware
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }));
app.use(cors())

app.use(session({
    name: 'mahirjeremy-connect.sid',
    resave: true,
    saveUninitialized: true,
    secret: SECRET_KEY,
    httpOnly: false,
    store: MongoStore.create({ mongoUrl: mongostr }),
    proxy: true,
    cookie: {
        domain: "mahirjeremy.cse356.compas.cs.stonybrook.edu"
    }
} as any))

//logger
app.use(morgan("tiny"))

app.use('/users', users)
app.use('/collection', collection)
app.use('/media', media)
app.use('/api', api);
app.use('/index', index);


app.listen(PORT, async () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
});
