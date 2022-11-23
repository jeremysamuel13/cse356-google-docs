import { Request, Response, Router } from 'express'
import multer from 'multer'
import { authMiddleware } from './users';
import { v4 as uuidv4 } from 'uuid'
import { File } from '../db/file';
import fs from 'fs'

const router = Router()

const extMap = {
    'image/jpeg': 'jpeg',
    'image/png': 'png',
    'image/gif': 'gif'
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, '/cse356-google-docs/server_uploads')
    },
    filename: (req, file, cb) => {
        const mediaid = uuidv4()
        const ext = extMap[file.mimetype]
        cb(null, `${mediaid}.${ext}`)
    }
})

const fileFilter = (req, file, cb) => {
    cb(null, Object.keys(extMap).includes(file.mimetype))
}

const uploadFile = multer({
    storage: storage,
    fileFilter: fileFilter
})

export const upload = async (req, res: Response) => {
    const starttime = performance.now()

    if (!req.file) {
        return res.json({ error: true, message: "Error uploading file" })
    }

    const image = req.file
    const mediaid = image.filename.split('.')[0]
    res.json({ error: false, mediaid })
    await File.create({ mimetype: image.mimetype, mediaid, filepath: image.path })
    console.log({ ...image, logstr: `Took ${performance.now() - starttime} upload` })
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
            return res.end(data)
        }
    })
}

router.use(authMiddleware)
router.post('/upload', uploadFile.single("file"), upload)
router.get('/access/:mediaid', access)

export default router;