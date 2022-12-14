import { Request, Response, Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { authMiddleware } from './users';
import { ymongo } from '..';
import { createDocument, deleteDocument } from '../db/elasticsearch';
import mongoose from 'mongoose';
import * as Y from 'yjs'

const router = Router()

export const doesDocumentExist = async (id: string) => {
    const docs: Array<string> = await ymongo.getAllDocNames()
    return docs.includes(id)
}


interface CreateRequestPayload {
    name: string
}

export const create = async (req: Request<CreateRequestPayload>, res: Response) => {
    const { name } = req.body as any

    if (!name) {
        return res.json({ error: true, message: "Missing name" })
    }
    const id = uuidv4()
    const doc = await ymongo.getYDoc(id)
    await ymongo.storeUpdate(id, Y.encodeStateAsUpdate(doc))
    await ymongo.setMeta(id, 'name', name);
    await createDocument(id, doc, name);

    return res.json({ error: false, id })
}

interface DeleteRequestPayload {
    id: string
}

export const deleteCollection = async (req: Request<DeleteRequestPayload>, res: Response) => {
    const { id } = req.body as any

    if (!id) {
        return res.json({ error: true, message: "Missing id" })
    }

    await ymongo.clearDocument(id)
    await ymongo.delMeta(id, 'name')
    await deleteDocument(id)

    return res.json({ error: false });
}

interface ListElement {
    id: string,
    name: string
}

type ListResponsePayload = ListElement[]

export const list = async (req: Request, res: Response<ListResponsePayload>) => {
    const { db } = mongoose.connection
    const agg = await db.collection("docs").aggregate([{ $group: { _id: "$docName", date: { $max: { $toDate: "$_id" } } } }, { $sort: { date: -1 } }, { $limit: 10 }]).toArray()
    const top10 = await Promise.all(agg.map(async doc => ({ id: doc._id, lastModified: doc.date, name: await ymongo.getMeta(doc._id, 'name') })))

    return res.json(top10)
}

router.use(authMiddleware)
router.post('/create', create)
router.post('/delete', deleteCollection)
router.get('/list', list)

export default router;