import * as dotenv from 'dotenv'
import { connect, ConsumeMessage } from 'amqplib'
import { Client as ElasticClient } from '@elastic/elasticsearch'
import { UpdateMessage, Update, ElasticDoc, UpdateElasticDoc } from './interfaces'

dotenv.config()

const { AMQP_URL, QUEUE_NAME, ELASTICSEARCH_ENDPOINT, ELASTICSEARCH_USER, ELASTICSEARCH_PASS } = process.env

console.log(AMQP_URL)
const FLUSH_INTERVAL = 1250;
const INDEX = 'cse356-m4';

const elastic_client = new ElasticClient({
    node: ELASTICSEARCH_ENDPOINT!,
    auth: {
        username: ELASTICSEARCH_USER!,
        password: ELASTICSEARCH_PASS!
    }
})

let needs_refresh = false

const updates = new Map<String, Update>

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

    const operations = values.map(({ id, doc }) => [{ update: { _id: id } }, { doc }]).flat()

    console.log(operations)

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
    const message: UpdateMessage = JSON.parse(msg.content.toString())

    const { id, contents } = message

    console.log(`Got message from: ${id}`)
    console.log(message)

    updates.set(id, {
        id,
        doc: {
            contents
        }

    })

    needs_refresh = true

    if (!interval) {
        interval = setInterval(flushQueue, FLUSH_INTERVAL)
    }
}, { noAck: true })
