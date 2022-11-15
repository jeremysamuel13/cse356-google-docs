import { Request, Response, Router } from 'express'
import fileUpload from 'express-fileupload'
import { authMiddleware } from './users';

const router = Router()

export const upload = async (req: Request, res: Response) => {
    //req.files.<file>
}

export const access = async (req: Request, res: Response) => {

}

router.use(authMiddleware)
router.post('/upload', fileUpload({}), upload)
router.get('/access/:mediaid', access)

export default router;