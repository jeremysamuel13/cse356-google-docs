import { Request, Response, Router } from 'express'
import { ymongo } from '../index'
import * as Y from "yjs";
import { v4 as uuidv4 } from 'uuid'
import { authMiddleware } from './users';
import mongoose from 'mongoose'

const router = Router()

export const doesDocumentExist = async (ymongo, document) => {
    const documents: Array<string> = await ymongo.getAllDocNames()
    const doc = documents.find((val) => val === document)
    return !!doc
}

export const doesDocumentNameExist = async (ymongo, name) => {
    const documents: Array<string> = await ymongo.getAllDocNames()
    for (let e of documents) {
        const metaVal = await ymongo.getMeta(e, 'name')
        if (metaVal === name) {
            return { exists: true, id: e }
        }
    }

    return { exists: false }
}


interface CreateRequestPayload {
    name: string
}

export const create = async (req: Request<CreateRequestPayload>, res: Response) => {
    const { name } = req.body as any

    if (!name) {
        return res.json({ error: true, message: "Missing name" })
    }

    const { exists, id: existingID } = await doesDocumentNameExist(ymongo, name)
    if (exists) {
        return res.json({ error: true, message: "Document already exists", id: existingID })
    }

    const id = uuidv4()

    const doc = await ymongo.getYDoc(id)
    await ymongo.setMeta(id, 'name', name)
    await ymongo.storeUpdate(id, Y.encodeStateAsUpdate(doc))

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

    if (!(await doesDocumentExist(ymongo, id))) {
        return res.json({ error: true, message: "Document doesn't exists" })
    }

    await ymongo.delMeta(id, 'name')
    await ymongo.clearDocument(id);

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