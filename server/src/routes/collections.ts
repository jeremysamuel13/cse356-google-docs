import { Request, Response, Router } from 'express'
import { ymongo } from '../index'
import * as Y from "yjs";
import { v4 as uuidv4 } from 'uuid'
import { authMiddleware } from './users';

const router = Router()

export const doesDocumentExist = async (ymongo, document) => {
    const documents: Array<string> = await ymongo.getAllDocNames()
    return documents.filter((val) => val === document).length > 0
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

    if (await doesDocumentExist(ymongo, id)) {
        return res.json({ error: true, message: "Document already exists" })
    }

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

    if (await doesDocumentExist(ymongo, id)) {
        return res.json({ error: true, message: "Document doesn't exists" })
    }

    const doc = await ymongo.getYDoc(id)
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
    const documents: Array<string> = await ymongo.getAllDocNames()
    const data = await Promise.all(documents.map(async doc => ({ id: doc, name: await ymongo.getMeta(doc, 'name') as string })))
    res.json(data);
}

router.use(authMiddleware)
router.post('/create', create)
router.post('/delete', deleteCollection)
router.get('/list', list)

export default router;