import { clients, elastic_client } from "../index";
import * as Y from "yjs";

const FLUSH_INTERVAL = 1500;
export const INDEX = 'cse356-m3';

export interface ElasticDoc {
    name: string,
    contents: string
}

type UpdateElasticDoc = Omit<ElasticDoc, "name">

class ElasticQueue {
    queue: Set<string>
    interval: NodeJS.Timer | null

    constructor() {
        this.queue = new Set()
        this.interval = null
        //console.log("created queue")
    }

    queueUpdate(id: string) {
        this.queue.add(id)
        this.startInterval()
        //console.log(`Added to queue: ${id}`)
    }

    async flushQueue() {
        if (this.queue.size === 0) {
            this.stopInterval()
        } else {
            const keys = Array.from(this.queue.keys())
            this.queue.clear()
            const operations = (keys.map(id => [{ index: { _id: id } }, { doc: this.getBulkReq(id) }])).flat()
            await elastic_client.bulk<ElasticDoc, UpdateElasticDoc>({
                index: INDEX,
                operations
            })
            // await refresh()
            // console.log("Queue flushed")
        }
    }

    getBulkReq(id: string) {
        const doc = clients[id].doc
        //console.log(`Flushed from queue: ${id}`)
        return {
            contents: doc.getText().toJSON()
        }
    }

    startInterval() {
        if (!this.interval) {
            this.interval = setInterval(() => { this.flushQueue() }, FLUSH_INTERVAL)
            //console.log("Interval started")
        }
    }

    stopInterval() {
        this.interval && clearInterval(this.interval)
        this.interval = null
        //console.log("Interval stopped")
    }
}

export const elastic_queue = new ElasticQueue()

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

// export const refresh = async () => {
//     console.log("Refreshing index")
//     return await elastic_client.indices.refresh({ index: INDEX })
// }

export const createDocument = async (id: string, document: Y.Doc, name: string) => {
    const res = await elastic_client.index<ElasticDoc>({
        id,
        index: INDEX,
        document: {
            contents: document.getText().toJSON(),
            name
        }
    })
    // await refresh()
    return res
}

export const deleteDocument = async (id: string) => {
    try {
        const res = await elastic_client.delete({
            id,
            index: INDEX
        })
        // await refresh()
        return res
    } catch {
        return null
    }
}

export const updateDocument = (id: string) => {
    elastic_queue.queueUpdate(id)
}
