import dotenv from 'dotenv';

import { Request, Response, Router } from 'express'
import multer from 'multer'
import { authMiddleware } from './users';
import { v4 as uuidv4 } from 'uuid'
import { File } from '../db/file';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import multerS3 from 'multer-s3'

dotenv.config()
const { S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY } = process.env

const router = Router()

const extMap = {
    'image/jpeg': 'jpeg',
    'image/png': 'png',
    'image/gif': 'gif'
}

const s3 = new S3Client({
    endpoint: S3_ENDPOINT!,
    credentials: {
        accessKeyId: S3_ACCESS_KEY!,
        secretAccessKey: S3_SECRET_KEY!
    },
    region: 'us-east-1' //doesnt do anything, just bypasses error

})

const storage = multerS3({
    s3,
    bucket: 'images',
    key: (req, file, cb) => {
        const mediaid = uuidv4()
        cb(null, mediaid)
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
    if (!req.file) {
        return res.json({ error: true, message: "Error uploading file" })
    }

    const image = req.file
    await File.create({ mimetype: image.mimetype, mediaid: image.key })
    return res.json({ error: false, mediaid: image.key })
}

export const access = async (req: Request, res: Response) => {
    const { mediaid } = req.params

    const file = await File.findOne({ mediaid })

    if (!file) {
        return res.json({ error: true, message: "File not found" })
    }

    try {
        const { Body } = await s3.send(new GetObjectCommand({
            Bucket: "images",
            Key: mediaid
        }))

        res.writeHead(200, { "Content-Type": file.mimetype });
        return res.end(await Body?.transformToByteArray())
    } catch (e) {
        //console.error(e)
        return res.json({ error: true, message: "File not found" })
    }
}


router.use(authMiddleware)
router.post('/upload', uploadFile.single("file"), upload)
router.get('/access/:mediaid', access)

export default router;