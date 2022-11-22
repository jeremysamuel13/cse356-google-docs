import { Request, Response, Router } from 'express'
import { elastic_client } from '../index'
import { ElasticDoc, INDEX } from '../db/elasticsearch'
import { authMiddleware } from './users';


const router = Router()

export const search = async (req: Request, res: Response) => {
    const { q } = req.query

    if (!q) {
        return res.json({ error: true, message: "Missing query param" })
    }

    const search_results = await elastic_client.search<ElasticDoc>({
        index: INDEX,
        query: {
            multi_match: {
                query: q as string,
                fields: ["contents", "name"]
            }
        },
        highlight: {
            fields: {
                contents: {
                    number_of_fragments: 1
                },
                name: {
                    number_of_fragments: 1
                }
            }
        },
        size: 10
    })

    const mapped = search_results.hits?.hits?.map(val => {
        const base = { id: val._source?.name, docid: val._id }
        if (val.highlight?.name) {
            return { ...base, snippet: val.highlight?.name[0] }
        }

        if (val.highlight?.contents) {
            return { ...base, snippet: val.highlight?.contents[0] }
        }

        return { snippet: null }
    })

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
        size: 10
    })

    console.log(search_results)

    return res.json([`${q}is`, `${q}as`, `${q}een`, `${q}art`])
}

router.use(authMiddleware)
router.get('/search', search)
router.get('/suggest', suggest)

export default router;