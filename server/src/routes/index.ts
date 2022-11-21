import { Request, Response, Router } from 'express'
import fileUpload from 'express-fileupload'
import { authMiddleware } from './users';
import { v4 as uuidv4 } from 'uuid'
import { File } from '../db/file';
import fs from 'fs'

const router = Router()

export const search = async (req: Request, res: Response) => {

}

export const suggest = async (req: Request, res: Response) => {

}

router.get('/search', search)
router.get('/suggest', suggest)

export default router;