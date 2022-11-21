import { elastic_client, ymongo } from "../index";
import { QuillDeltaToHtmlConverter } from 'quill-delta-to-html';
import { Doc } from "yjs";

const FLUSH_INTERVAL = 1000;
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
            await Promise.all(keys.map(id => this.flushEntry(id)))
            await refresh()
            //console.log("Queue flushed")
        }
    }

    async flushEntry(id: string) {
        const doc = await ymongo.getYDoc(id);
        //console.log(`Flushed from queue: ${id}`)
        return await elastic_client.update<ElasticDoc, UpdateElasticDoc>({
            index: INDEX,
            id,
            doc: {
                contents: toHTML(doc)
            }
        })
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

export const createIndicies = async () => {
    const exists = await elastic_client.indices.exists({ index: INDEX })

    if (!exists) {
        console.log(`Elasticsearch index (${INDEX}) does not exist, creating.`)
        return await elastic_client.indices.create({
            index: INDEX,
            settings: {
                analysis: {
                    analyzer: {
                        htmlStripAnalyzer: {
                            type: "custom",
                            tokenizer: "standard",
                            filter: ["lowercase"],
                            char_filter: [
                                "html_strip"
                            ]
                        }
                    }
                }
            },
            mappings: {
                properties: {
                    contents: {
                        type: "text",
                        analyzer: "htmlStripAnalyzer"
                    }
                }
            }
        })
    }
}

export const refresh = async () => {
    //console.log("Refreshing index")
    return await elastic_client.indices.refresh({ index: INDEX })
}

export const createDocument = async (id: string, document: Doc, name: string) => {
    const res = await elastic_client.index<ElasticDoc>({
        id,
        index: INDEX,
        document: {
            contents: toHTML(document),
            name
        }
    })
    await refresh()
    return res
}

export const deleteDocument = async (id: string) => {
    const res = await elastic_client.delete({
        id,
        index: INDEX
    })
    await refresh()
    return res
}

export const updateDocument = async (id: string) => {
    elastic_queue.queueUpdate(id)
}

const toHTML = (document: Doc) => {
    const converter = new QuillDeltaToHtmlConverter(document.getText().toDelta())
    return converter.convert()
}
