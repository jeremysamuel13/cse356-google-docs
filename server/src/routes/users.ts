import { NextFunction, Request, Router, Response } from 'express'
import { Account } from '../db/userSchema'
import { v4 as uuidv4 } from 'uuid'
import { putUser } from '../db/userManagement'
import { transport, clients } from '../index'

const router = Router()

interface SignUpPayload {
    email: string, name: string, password: string
}

declare module 'express-session' {
    interface SessionData {
        email: string;
        password: string;
        name: string;
    }
}

const signup = async (req: Request<SignUpPayload>, res: Response) => {
    const { email, name, password } = req.body

    console.log({ email })


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

    res.json({ error: false })

    await transport.sendMail({
        from: 'root@mahirjeremy.cse356.compas.cs.stonybrook.edu',
        to: email,
        subject: 'Verify account for CSE 356 website',
        text: verificationLink
    })
}

const verify = async (req: Request, res: Response) => {
    const { email, key } = req.query;

    console.log({ email })


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
        req.session.email = user.email
        req.session.password = user.password
        req.session.name = user.name
        return res.json({ error: false })
    }

    return res.json({ error: true, message: "Invalid verification" })
}

interface LoginPayload {
    email: string, password: string
}

const login = async (req: Request<LoginPayload>, res: Response) => {
    const { email, password } = req.body

    console.log({ email })

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
        req.session.email = email
        req.session.password = password
        req.session.name = user.name

        console.log(`Login: set session: ${req.sessionID}`)

        return res.json({ error: false, name: user.name })
    } else {
        console.log(`Login: wrong pass. Got ${password}, expected: ${user.password}`)
        return res.json({ error: true, message: "Invalid password" })
    }
}

const logout = async (req: Request, res: Response) => {
    if (req.session.email || req.session.password || req.session.id) {
        req.session.destroy(() => { console.log("destroyed session") })
        res.json({ error: false });
        await Promise.all(Object.values(clients).map(async (cl) => {
            await cl.clients.removeClient(req.sessionID)
        }))
        return
    }
    return res.json({ error: false, message: "Session not found" });
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.session as any;

    if (!email || !password) {
        console.log(`Middleware (${req.sessionID}): No email/pass`)
        return res.json({ error: true, message: "Email/password not supplied" });
    }

    const acc = await Account.exists({ email, password });
    if (!acc) {
        console.log(`Middleware (${req.sessionID}): User not found`)
        return res.json({ error: true, message: "User not found" });
    }

    next()
}

router.post('/signup', signup)
router.post('/login', login)
router.post('/logout', logout)
router.get('/verify', verify)

export default router;
