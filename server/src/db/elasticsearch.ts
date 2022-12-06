import { elastic_client, es_amqp_channel, ymongo, ES_QUEUE_NAME } from "../index";
import * as Y from "yjs";
import { UpdateMessage } from 'elasticsearch-server/src/interfaces'

// const FLUSH_INTERVAL = 750;
export const INDEX = 'cse356-m4';

export interface ElasticDoc {
    name: string,
    contents: string
}

type UpdateElasticDoc = Omit<ElasticDoc, "name">

// export class ElasticQueue {
//     queue: Set<string>
//     interval: NodeJS.Timer | null

//     constructor() {
//         this.queue = new Set()
//         this.interval = null
//         //console.log("created queue")
//     }

//     queueUpdate(id: string) {
//         this.queue.add(id)
//         this.startInterval()
//         //console.log(`Added to queue: ${id}`)
//     }

//     async flushQueue() {
//         if (this.queue.size === 0) {
//             this.stopInterval()
//         } else {
//             const keys = Array.from(this.queue.keys())
//             this.queue.clear()
//             const operations = (await Promise.all((keys.map(async id => [{ update: { _id: id } }, { doc: await this.getBulkReq(id) }])))).flat()
//             await elastic_client.bulk<ElasticDoc, UpdateElasticDoc>({
//                 index: INDEX,
//                 operations,
//                 refresh: true
//             })
//         }
//     }

//     async getBulkReq(id: string) {
//         const doc = await ymongo.getYDoc(id)
//         //console.log(`Flushed from queue: ${id}`)
//         return {
//             contents: doc.getText().toJSON()
//         }
//     }

//     startInterval() {
//         if (!this.interval) {
//             this.interval = setInterval(() => { this.flushQueue() }, FLUSH_INTERVAL)
//             //console.log("Interval started")
//         }
//     }

//     stopInterval() {
//         this.interval && clearInterval(this.interval)
//         this.interval = null
//         //console.log("Interval stopped")
//     }
// }

// export const elastic_queue = new ElasticQueue()

//console.log("CREATED QUEUE")
//console.log(elastic_queue)

export const deleteIndicies = async () => {
    console.log(`DELETING ELASTICSEARCH INDEX: ${INDEX}`)
    await elastic_client.indices.delete({ index: INDEX })
}

export const createIndicies = async (del: boolean) => {
    if (del) {
        console.log("DELETING INDICES")
        await deleteIndicies()
    }

    const exists = await elastic_client.indices.exists({ index: INDEX })

    if (!exists) {
        console.log(`Elasticsearch index (${INDEX}) does not exist, creating.`)
        return await elastic_client.indices.create({
            index: INDEX
        })
    }
}


export const createDocument = async (id: string, document: Y.Doc, name: string) => {
    const res = await elastic_client.index<ElasticDoc>({
        id,
        index: INDEX,
        document: {
            contents: document.getText().toJSON(),
            name
        }
    })
    return res
}

export const deleteDocument = async (id: string) => {
    try {
        const res = await elastic_client.delete({
            id,
            index: INDEX
        })
        return res
    } catch {
        return null
    }
}

//send updates to elasticsearch server
export const updateDocument = async (id: string) => {
    const doc: Y.Doc = await ymongo.getYDoc(id)
    es_amqp_channel.sendToQueue(ES_QUEUE_NAME!, Buffer.from(id))
}
