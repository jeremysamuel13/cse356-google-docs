import { Request, Response, Router } from 'express'
import { elastic_client } from '..'
import { ElasticDoc, INDEX } from '../db/elasticsearch'


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
                contents: {},
                name: {}
            }
        }
    })

    console.log(search_results)

    return res.json({ error: false, results: search_results })
}

export const suggest = async (req: Request, res: Response) => {

}

router.get('/search', search)
router.get('/suggest', suggest)

export default router;