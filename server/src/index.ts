import express, { Express } from 'express';
import { Clients } from './interfaces'
import dotenv from 'dotenv';
import { MongodbPersistence } from "y-mongodb-provider";
import cors from 'cors';
import morgan from 'morgan'
import session from 'cookie-session'
import Keygrip from 'keygrip'
import fileUpload from 'express-fileupload'
import { v4 as uuidv4 } from 'uuid'
import { connect as mongoConnect } from 'mongoose'

import { authMiddleware, login, logout, signup, verify, status } from './routes/auth'
import { create, deleteCollection, list } from './routes/collections'
import { upload, access } from './routes/media'
import { connect, op, presence } from './routes/api'

// Allow for interaction with dotenv
dotenv.config();

const { PORT, COLLECTION, DB, DB_USER, DB_PASS, DB_HOST, DB_PORT, SESSION_KEYS } = process.env;

const app: Express = express();
app.use(cors({
    credentials: true
}));

const mongostr = `mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB}?authSource=admin`

export const ymongo = new MongodbPersistence(mongostr, {
    collectionName: COLLECTION
});

export const clients = {} as Clients

// JSON Middleware
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true }));
app.use(cors())

app.use(session({
    name: '356-session',
    keys: new Keygrip(JSON.parse(SESSION_KEYS ?? "[]"), 'SHA384', 'base64'),
    resave: false,
    saveUninitialized: false
} as any))

//logger
app.use(morgan("tiny"))

app.post('/users/signup', signup)
app.post('/users/login', login)
app.post('/users/logout', logout)
app.get('/users/verify', verify)
app.get('/status', status)

//requires a login
app.use(authMiddleware)

app.post('/collection/create', create)
app.post('/collection/delete', deleteCollection)
app.get('/collection/list', list)

app.post('/media/upload', fileUpload({}), upload)
app.get('/media/access/:mediaid', access)

app.get('/api/connect/:id', connect);
app.post('/api/op/:id', op)
app.post('/api/presence/:id', presence)

mongoConnect(mongostr, (val) => console.log(val ?? "connected to docs db"));

app.listen(PORT, async () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
});
