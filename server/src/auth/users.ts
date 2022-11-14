import { NextFunction, Request, Response } from 'express';
import { sign } from 'jsonwebtoken';
import passport from 'passport';
import { IUser, User } from '../db/models';
import { JWT_SECRET } from '../server';


 import './passportAuth';
 import { putUser } from '../db/userManagement';

export async function signUp(req: Request<{ username: string, password: string, email: string }>, res: Response): Promise<void> {
    const { email, username, password } = req.body

    const user = await putUser(username, email, password)

    res.json({ success: true, ...issueJWT(user) })

}

export function authenticateUser(req: Request, res: Response, next: NextFunction) {
    passport.authenticate('local', { session: false }, function (err, user, info) {
        // no async/await because passport works only with callback ..
        if (err) return next(err)
        if (!user) {
            return res.status(401).json({ status: 'error', code: 'unauthorized' })
        } else {
            const token = issueJWT(user)
            res.json({ success: true, ...issueJWT(user) })
        }
    });
}

export function authenticateJWT(req: Request, res: Response, next: NextFunction) {
    passport.authenticate('jwt', { session: false }, function (err, user, info) {
        if (err) {
            console.log(err)
            return res.status(401).json({ status: 'error', code: 'unauthorized' })
        }
        if (!user) {
            return res.status(401).json({ status: 'error', code: 'unauthorized' })
        } else {
            return next()
        }
    })(req, res, next)
}

export function issueJWT(user: IUser) {

    const expiresIn = '1d'

    const payload = {
        sub: user.username,
        iat: Date.now()
    }

    const signedToken = sign(payload, JWT_SECRET, { expiresIn, algorithm: "RS256" })

    return {
        token: "Bearer " + signedToken,
        expiresIn
    }
}