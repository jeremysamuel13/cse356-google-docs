import { Request, Response, Router } from 'express'
import { elastic_client } from '../index'
import { ElasticDoc, INDEX } from '../db/elasticsearch'
import { authMiddleware } from './users';

const router = Router()

export const search = async (req: Request, res: Response) => {
    const { q } = req.query as { q: string }

    if (!q) {
        return res.json({ error: true, message: "Missing query param" })
    }

    const search_results = await elastic_client.search<ElasticDoc>({
        index: INDEX,
        query: {
            multi_match: {
                query: q,
                fields: ["contents", "name"],
            }
        },
        highlight: {
            order: "score",
            fields: {
                contents: {},
                name: {},
            }
        },
        _source: {
            include: ["name"],
            exclude: ["contents"]
        }
    })

    const mapped = search_results.hits?.hits?.map(val => {
        const base = { id: val._source?.name, docid: val._id }
        if (val.highlight?.name) {
            return { ...base, snippet: val.highlight?.name.join('\n') }
        }

        if (val.highlight?.contents) {
            return { ...base, snippet: val.highlight?.contents.join('\n') }
        }
    })

    // console.log({ q, mapped, type: "SEARCH" })

    return res.json(mapped)
}

export const suggest = async (req: Request, res: Response) => {
    const { q } = req.query

    if (!q) {
        return res.json({ error: true, message: "Missing query param" })
    }

    const search_results = await elastic_client.search<ElasticDoc>({
        index: INDEX,
        query: {
            bool: {
                should: [
                    {
                        match_phrase_prefix: {
                            contents: q as string
                        }
                    },
                    {
                        match_phrase_prefix: {
                            name: q as string
                        }
                    },
                ]
            }
        },
        highlight: {
            boundary_scanner: "word",
            fields: {
                contents: {},
                name: {}
            },
            pre_tags: [""],
            post_tags: [""]
        },
        _source: false
    })

    const mapped = [...new Set(search_results.hits.hits.flatMap(h => [...(h.highlight?.name ?? []), ...(h.highlight?.contents ?? [])].map(word => word.toLowerCase())))]

    return res.json(mapped)
}

router.use(authMiddleware)
router.get('/search', search)
router.get('/suggest', suggest)

export default router;