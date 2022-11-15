import express, { Express } from 'express';
import { Clients } from './interfaces'
import dotenv from 'dotenv';
import { MongodbPersistence } from "y-mongodb-provider";
import cors from 'cors';
import morgan from 'morgan'
import session from 'cookie-session'
import { connect as mongoConnect } from 'mongoose'

import users from './routes/users'
import collection from './routes/collections'
import media from './routes/media'
import api from './routes/api'

// Allow for interaction with dotenv
dotenv.config();

const { PORT, COLLECTION, DB, DB_USER, DB_PASS, DB_HOST, DB_PORT, SECRET_KEY } = process.env;

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
    resave: false,
    saveUninitialized: false,
    secret: SECRET_KEY
} as any))

//logger
app.use(morgan("tiny"))

app.use('/users', users)
app.use('/collection', collection)
app.use('/media', media)
app.use('/api', api);

mongoConnect(mongostr, (val) => console.log(val ?? "connected to docs db"));

app.listen(PORT, async () => {
    console.log(`⚡️[server]: Server is running at http://localhost:${PORT}`);
});
