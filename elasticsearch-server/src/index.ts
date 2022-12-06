import * as dotenv from 'dotenv'
import { connect, ConsumeMessage } from 'amqplib'
import { Client as ElasticClient } from '@elastic/elasticsearch'
import { ElasticDoc, UpdateElasticDoc } from './interfaces'
import { MongodbPersistence } from 'y-mongodb-provider'
import { Doc } from 'yjs'


dotenv.config()

const { AMQP_URL, QUEUE_NAME, ELASTICSEARCH_ENDPOINT, ELASTICSEARCH_USER, ELASTICSEARCH_PASS } = process.env
export const { PORT, COLLECTION, DB, DB_USER, DB_PASS, DB_HOST, DB_PORT } = process.env;


console.log(AMQP_URL)
const FLUSH_INTERVAL = 2250;
const INDEX = 'cse356-m4';

const elastic_client = new ElasticClient({
    node: ELASTICSEARCH_ENDPOINT!,
    auth: {
        username: ELASTICSEARCH_USER!,
        password: ELASTICSEARCH_PASS!
    }
})

const mongostr = `mongodb://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB}?authSource=admin`

export const ymongo = new MongodbPersistence(mongostr, {
    collectionName: COLLECTION,
    flushSize: 25
});

let needs_refresh = false

const updates: Set<string> = new Set()

const conn = await connect(AMQP_URL!)

const channel = await conn.createChannel()

await channel.assertQueue(QUEUE_NAME!)
channel.prefetch(10)

const flushQueue = async () => {
    if (!needs_refresh) {
        clearInterval(interval!)
        interval = null
        return
    }

    const values = Array.from(updates.values())
    console.log(`Updating: ${Array.from(updates.keys())}`)
    updates.clear()

    needs_refresh = false

    const operations = (await Promise.all(values.map(async id => [{ update: { _id: id } }, { doc: (await ymongo.getYDoc(id) as Doc).getText().toJSON() }]))).flat()

    if (operations.length > 0) {
        await elastic_client.bulk<ElasticDoc, UpdateElasticDoc>({
            index: INDEX,
            operations,
            refresh: true
        })
    }
}

let interval: NodeJS.Timer | null = null

await channel.consume(QUEUE_NAME!, (msg: ConsumeMessage | null) => {
    if (!msg) {
        return
    }

    //UPDATE ELASTICSEARCH INDEX
    const id = msg.content.toString()

    console.log(`Got message from: ${id}`)

    updates.add(id)

    needs_refresh = true

    if (!interval) {
        interval = setInterval(flushQueue, FLUSH_INTERVAL)
    }
}, { noAck: true })
