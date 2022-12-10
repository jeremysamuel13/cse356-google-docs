import dotenv from 'dotenv';

import express, { Express } from 'express';
import session from 'express-session'

import { connect as mongoConnect } from 'mongoose'

import { Client as ElasticClient } from '@elastic/elasticsearch'
import { createIndicies } from './db/elasticsearch';

import { default as users } from './routes/users'
import { default as collection } from './routes/collections'
import { default as media } from './routes/media'
import { default as api } from './routes/api'
import { default as index } from './routes/index'
import { connect } from 'amqplib'
import { MongodbPersistence } from 'y-mongodb-provider'
import { default as MongoStore } from 'connect-mongo'

// Allow for interaction with dotenv
dotenv.config();

export const { PORT, COLLECTION, DB, DB_USER, DB_PASS, DB_HOST, DB_PORT, SECRET_KEY, DELETE, ELASTICSEARCH_ENDPOINT, ELASTICSEARCH_USER, ELASTICSEARCH_PASS, ES_AMQP_URL, ES_QUEUE_NAME, SSE_AMQP_URL, SSE_UPDATE_QUEUE_NAME, SSE_PRESENCE_QUEUE_NAME, MAIL_AMQP_URL, MAIL_QUEUE_NAME } = process.env;

const mongostr = `mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB}?authSource=admin`


//MONGO + YJS
export const ymongo = new MongodbPersistence(mongostr, {
    collectionName: COLLECTION
});

mongoConnect(mongostr, (val) => console.log(val ?? "connected to docs db"));

//ELASTICSEARCH
export const elastic_client = new ElasticClient({
    node: ELASTICSEARCH_ENDPOINT,
    auth: {
        username: ELASTICSEARCH_USER!,
        password: ELASTICSEARCH_PASS!
    }
})

//es amqp
const es_amqp_conn = await connect(ES_AMQP_URL!)
export const es_amqp_channel = await es_amqp_conn.createChannel()
await es_amqp_channel.assertQueue(ES_QUEUE_NAME!)

//sse amqp
const sse_amqp_conn = await connect(SSE_AMQP_URL!)
export const sse_amqp_channel = await sse_amqp_conn.createChannel()
await sse_amqp_channel.assertQueue(SSE_UPDATE_QUEUE_NAME!)
await sse_amqp_channel.assertQueue(SSE_PRESENCE_QUEUE_NAME!)

const mail_amqp_conn = await connect(MAIL_AMQP_URL!)
export const mail_amqp_channel = await mail_amqp_conn.createChannel()
await mail_amqp_channel.assertQueue(MAIL_QUEUE_NAME!)


// EXPRESS
const app: Express = express();

// JSON Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }));


//Cookie-based sessions
app.use(session({
    resave: false,
    saveUninitialized: false,
    secret: "secret",
    store: MongoStore.create({
        mongoUrl: mongostr,
        ttl: 60 * 60 // = 1hr
    })
}))

//routes
app.use('/users', users)
app.use('/collection', collection)
app.use('/media', media)
app.use('/api', api);
app.use('/index', index);

//Health check
app.get('/health', (req, res) => {
    res.status(200).send('Ok');
});

app.listen(PORT, async () => {
    //console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
})

