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
console.log(mongostr)


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

await createIndicies(DELETE === "true")

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

//logger
// app.use(morgan((tokens, req, res) => {
//     return JSON.stringify({
//         'remote_address': tokens['remote-addr'](req, res),
//         'time': tokens['date'](req, res, 'iso'),
//         'method': tokens['method'](req, res),
//         'url': tokens['url'](req, res),
//         'http_version': tokens['http-version'](req, res),
//         'status_code': tokens['status'](req, res),
//         'content_length': tokens['res'](req, res, 'content-length'),
//         'referrer': tokens['referrer'](req, res),
//         'user_agent': tokens['user-agent'](req, res),
//         'response_time': tokens['response-time'](req, res)
//     })
// }, { stream: fs.createWriteStream('./access.log', { flags: 'a' }) }))

// JSON Middleware
app.use(express.json())
app.use(express.urlencoded({ extended: true }));

// app.use((req, res, next) => {
//     const ref = res.send;

//     res.send = function (val?) {
//         try {
//             const content = JSON.parse(val);

//             if (content.error) {
//                 res.setHeader("X-API-ERROR", "true");
//                 res.setHeader("X-API-ERROR-DESCRIPTION", content.message);
//             } else {
//                 res.setHeader("X-API-ERROR", "false");
//             }
//         } catch {
//             console.error("ERROR SETTING ERROR HEADERS");
//         }

//         return ref.call(this, val);
//     };

//     next();
// });


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

// app.get('/server/logs', async (req, res) => {
//     const allFileContents = fs.readFileSync('./access.log', 'utf-8');

//     const logMap = new Map<String, { logs: any[] }>();

//     allFileContents.split(/\r?\n/).forEach(line => {
//         try {
//             const data = JSON.parse(line)
//             const [_, first, second] = data.url.split('/') as string[]
//             let key = ''
//             if (first) { key = key + `/${first}` }
//             if (first !== "edit" && second) {
//                 key = key + `/${second.split("?")[0]}`
//             }
//             if (!logMap.get(key)) { logMap.set(key, { logs: [] }) }
//             logMap.get(key)!.logs.push(data)
//         } catch {

//         }
//     });

//     return res.json([...logMap.entries()].map(([key, { logs }]) => {
//         let times: number[] = []
//         let total = 0
//         let errors = 0


//         logs.forEach(log => {
//             const response_time = parseFloat(log.response_time)

//             if (parseInt(log.status_code) >= 400) {
//                 errors = errors + 1
//             }

//             total = total + response_time
//             times.push(response_time)
//         })

//         times.sort((a, b) => b - a)


//         return {
//             key, max: times[0], min: times[times.length - 1], requests: logs.length, total_time: total, average: total / logs.length, errors, times: times.slice(0, 10)
//         }
//     }).sort((a, b) => b.max - a.max))
// })

//static routes: no auth needed
// app.get('/library/crdt.js', express.static("/cse356-google-docs/crdt/dist"), (req, res) => {
//     return res.sendFile('/cse356-google-docs/crdt/dist/crdt.js')
// })
// app.get('/library.crdt.js', express.static("/cse356-google-docs/crdt/dist"), (req, res) => {
//     return res.sendFile('/cse356-google-docs/crdt/dist/crdt.js')
// })

// app.get('/*', express.static("/cse356-google-docs/client/build"), (req, res) => {
//     if (!res.headersSent) {
//         res.setHeader('X-CSE356', '63094ca6047a1139b66d985a')
//     }

//     return res.sendFile('/cse356-google-docs/client/build/index.html')
// })

app.listen(PORT, async () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
})

