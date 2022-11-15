import { Request, Response, Router } from 'express'
import fileUpload from 'express-fileupload'
import { authMiddleware } from './users';
import { v4 as uuidv4 } from 'uuid'
import { File } from '../db/file';
import fs from 'fs'

const router = Router()

export const upload = async (req: Request, res: Response) => {
    const { image } = req.files as any
    if (!['image/jpeg', 'image/png'].includes(image.mimetype)) {
        return res.json({ error: true, message: "Invalid MIME type. Only accepts .jpeg and .png files" })
    }

    const mediaid = uuidv4()
    const ext = image.mimetype === 'image/png' ? 'png' : 'jpeg'
    const filepath = `/cse356-google-docs/server_uploads/${mediaid}.${ext}`

    image.mv(filepath, async (err) => {
        await File.create({ mimetype: image.mimetype, mediaid, filepath })
        if (err) {
            return res.json({ error: true, message: "Error uploading file" })
        }

        return res.json({ error: false, mediaid })
    })
}

export const access = async (req: Request, res: Response) => {
    const { mediaid } = req.params

    const file = await File.findOne({ mediaid })

    if (!file) {
        return res.json({ error: true, message: "File not found" })
    }

    fs.readFile(file.filepath, (err, data) => {
        if (err) {
            return res.json({ error: true, message: "File not found" })
        } else {
            res.writeHead(200, { "Content-Type": file.mimetype });
            res.end(data)
        }
    })
}

router.use(authMiddleware)
router.post('/upload', fileUpload({
    useTempFiles: true,
    tempFileDir: '/tmp/',
    debug: true
}), upload)
router.get('/access/:mediaid', access)

export default router;