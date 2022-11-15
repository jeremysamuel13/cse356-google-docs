import { NextFunction, Request, Router, Response } from 'express'
import { Account, IAccount } from '../db/userSchema'
import { v4 as uuidv4 } from 'uuid'
import { putUser } from '../db/userManagement'
import { createTransport } from 'nodemailer'

const router = Router()

interface SignUpPayload {
    email: string, username: string, password: string
}

export const signup = async (req: Request<SignUpPayload>, res: Response) => {
    const { email, username, password } = req.body

    console.log(req.body)

    if (!email || !username || !password) {
        return res.json({ error: true, message: "Username/email/password not found" })
    }

    const dups = await Account.find({ $or: [{ email }, { username }] })

    if (dups && dups.length > 0) {
        console.log("User already created!")
        return res.json({ error: true, message: "User already created" })
    }

    const verificationKey = uuidv4();

    await putUser(username, email, password, verificationKey)

    const verificationLink = `http://mahirjeremy.cse356.compas.cs.stonybrook.edu/verify?email=${encodeURIComponent(email)}&key=${verificationKey}`

    const transport = createTransport({
        sendmail: true,
        path: '/usr/sbin/sendmail',
        newline: 'unix'
    })

    transport.sendMail({
        from: 'root@mahirjeremy.cse356.compas.cs.stonybrook.edu',
        to: email,
        subject: 'Verify account for CSE 356 website',
        text: verificationLink
    }, (err, info) => console.log)

    return res.json({ error: false })
}

export const verify = async (req: Request, res: Response) => {
    const { email, key } = req.query;

    if (!email) {
        return res.json({ error: true, message: "Email not found" })
    }

    if (!key) {
        return res.json({ error: true, message: "Verification key not found" })
    }

    const user = await Account.findOne({ email })

    if (!user) {
        return res.json({ error: true, message: "User not found" })
    }

    if (key === user.verificationKey) {
        await Account.findOneAndUpdate({ email }, { isVerified: true })
        return res.json({ error: false })

    }

    return res.json({ error: true, message: "Invalid verification" })
}

interface LoginPayload {
    email: string, password: string
}

export const login = async (req: Request<LoginPayload>, res: Response) => {
    const { email, password } = req.body

    if (!email || !password) {
        return res.json({ error: true, message: "Username/password not found" })
    }

    const user = await Account.findOne({ email, password })

    if (!user) {
        return res.json({ error: true, message: "User not found" })
    }

    if (!user.isVerified) {
        return res.json({ error: true, message: "User not verified" })
    }

    if (req.session) {
        req.session.account = JSON.stringify({ email, password })
        req.session.id = uuidv4()
        return res.json({ error: false })
    } else {
        return res.json({ error: true, message: "Session not found" })
    }
}

export const logout = async (req: Request, res: Response) => {
    if (req.session?.account) {
        req.session.destroy()
        return res.json({ error: false });

    }
    return res.json({ error: false, message: "Session not found" });
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const { account } = req.session as any;
    const { email, password } = JSON.parse(account);

    if (!email || !password) {
        return res.json({ error: true, message: "Email/password not supplied" });
    }

    const acc = await Account.findOne({ email: email, password: password });
    if (!acc) {
        console.log("User not found")
        return res.json({ error: true, message: "User not found" });
    }

    res.locals.account = acc

    next()
}

//for debugging
export const status = async (req: Request, res: Response) => {
    const { account } = req.session as any;
    const { email, password } = JSON.parse(account);

    if (!email || !password) {
        return res.json({ error: true, message: "Email/password not supplied" });
    }

    const acc = await Account.findOne({ email: email, password: password });
    if (!acc) {
        console.log("User not found")
        return res.json({ error: true, message: "User not found" });
    }

    return res.json({ error: false })
}

router.post('/signup', signup)
router.post('/login', login)
router.post('/logout', logout)
router.get('/verify', verify)
router.get('/status', status)

export default router;
