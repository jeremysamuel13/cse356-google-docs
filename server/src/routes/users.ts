import { NextFunction, Request, Router, Response } from 'express'
import { Account } from '../db/userSchema'
import { v4 as uuidv4 } from 'uuid'
import { putUser } from '../db/userManagement'
import { createTransport } from 'nodemailer'

const router = Router()

interface SignUpPayload {
    email: string, name: string, password: string
}

declare module 'express-session' {
    interface SessionData {
        account: any;
    }
}

export const signup = async (req: Request<SignUpPayload>, res: Response) => {
    const { email, name, password } = req.body

    if (!email || !name || !password) {
        return res.json({ error: true, message: "name/email/password not found" })
    }

    const dups = await Account.find({ $or: [{ email }, { name }] })

    if (dups && dups.length > 0) {
        console.log("User already created!")
        return res.json({ error: true, message: "User already created" })
    }

    const verificationKey = uuidv4();


    await putUser(name, email, password, verificationKey)

    const verificationLink = `http://mahirjeremy.cse356.compas.cs.stonybrook.edu/users/verify?email=${encodeURIComponent(email)}&key=${verificationKey}`

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
    })

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
        req.session.account = JSON.stringify({ email, password: user.password })
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
        console.log(`Login: Name/pass not found`)
        return res.json({ error: true, message: "name/password not found" })
    }

    const user = await Account.findOne({ email })

    if (!user) {
        console.log(`Login: user not found`)
        return res.json({ error: true, message: "User not found" })
    }

    if (!user.isVerified) {
        console.log(`Login: user is not verified`)
        return res.json({ error: true, message: "User not verified" })
    }

    if (user.password === password) {
        req.session.account = JSON.stringify({ email, password })

        console.log(`Login: set session: ${req.sessionID}`)

        return res.json({ error: false, name: user.name })
    } else {
        console.log(`Login: wrong pass. Got ${password}, expected: ${user.password}`)
        return res.json({ error: true, message: "Invalid password" })

    }
}

export const logout = async (req: Request, res: Response) => {
    if (req.session.account || req.session.id) {
        req.session.destroy(() => { console.log("destroyed session") })
        return res.json({ error: false });

    }
    return res.json({ error: false, message: "Session not found" });
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const { account } = req.session as any;

    if (!account) {
        console.log(`Middleware (${req.sessionID}): No session`)
        return res.json({ error: true, message: "Session not found" });
    }

    const { email, password } = JSON.parse(account);

    if (!email || !password) {
        console.log(`Middleware (${req.sessionID}): No email/pass`)
        return res.json({ error: true, message: "Email/password not supplied" });
    }

    const acc = await Account.findOne({ email: email, password: password });
    if (!acc) {
        console.log(`Middleware (${req.sessionID}): User not found`)
        return res.json({ error: true, message: "User not found" });
    }

    res.locals.name = acc.name

    next()
}

//for debugging
export const status = async (req: Request, res: Response) => {
    const { account } = req.session as any;

    if (!account) {
        console.log(`Middleware (${req.sessionID}): No session`)
        return res.json({ error: true, message: "Session not found" });
    }

    const { email, password } = JSON.parse(account);

    if (!email || !password) {
        console.log(`Middleware (${req.sessionID}): No email/pass`)
        return res.json({ error: true, message: "Email/password not supplied" });
    }

    const acc = await Account.findOne({ email: email, password: password });
    if (!acc) {
        console.log(`Middleware (${req.sessionID}): User not found`)
        return res.json({ error: true, message: "User not found" });
    }

    return res.json({ error: false, message: "Session is valid" })
}

router.post('/signup', signup)
router.post('/login', login)
router.post('/logout', logout)
router.get('/verify', verify)
router.get('/status', status)

export default router;
