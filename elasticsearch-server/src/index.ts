import * as dotenv from 'dotenv'
import { connect, ConsumeMessage } from 'amqplib'
import { Client as ElasticClient } from '@elastic/elasticsearch'
import { UpdateMessage } from './interfaces'

dotenv.config()

const { AMQP_URL, QUEUE_NAME, ELASTICSEARCH_ENDPOINT, ELASTICSEARCH_USER, ELASTICSEARCH_PASS } = process.env

const FLUSH_INTERVAL = 750;
const INDEX = 'cse356-m4';

const elastic_client = new ElasticClient({
    node: ELASTICSEARCH_ENDPOINT!,
    auth: {
        username: ELASTICSEARCH_USER!,
        password: ELASTICSEARCH_PASS!
    }
})

let needs_refresh = false

const conn = await connect(AMQP_URL!)

const channel = await conn.createChannel()

await channel.assertQueue(QUEUE_NAME!)

setInterval(async () => {
    if (needs_refresh) {
        await elastic_client.indices.refresh({ index: INDEX })
    }
}, FLUSH_INTERVAL)

const updatesConsumer = channel.consume(QUEUE_NAME!, async (msg: ConsumeMessage | null) => {
    if (!msg) {
        return
    }

    //UPDATE ELASTICSEARCH INDEX
    const decoded: UpdateMessage = JSON.parse(msg.content.toString())
    await elastic_client.update({
        index: decoded.index,
        id: decoded.id,
        doc: {
            contents: decoded.contents
        },
        refresh: false
    })
    channel.ack(msg)
    needs_refresh = true
})

await Promise.all([updatesConsumer])