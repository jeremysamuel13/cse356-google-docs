import passport from 'passport'
import passportLocal from 'passport-local'
import passportJwt from 'passport-jwt'
import { Account } from '../db/userSchema.ts'
import { JWT_SECRET } from '../index.ts'

const LocalStrategy = passportLocal.Strategy
const JwtStrategy = passportJwt.Strategy
const ExtractJwt = passportJwt.ExtractJwt

passport.use('signup', new LocalStrategy({ usernameField: "username", passwordField: "password" }, (username, password, done) => {
    User.findOne({ username: username.toLowerCase() }, (err, user) => {
        if (err) {
            return done(err)
        }
        if (!user) {
            return done(undefined, false, { message: `username ${username} not found.` })
        }

        user.comparePassword(password, (err: Error, isMatch: boolean) => {
            if (err) {
                return done(err)
            }
            if (isMatch) {
                return done(undefined, user)
            }
            return done(undefined, false, { message: 'Invalid username or password.' })
        })
    })
}))

passport.use(
    new JwtStrategy(
        {
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            secretOrKey: JWT_SECRET,
            algorithms: ['RSA256']
        },
        function (jwtToken, done) {
            console.log(jwtToken)
            User.findById(jwtToken.sub, function (err, user) {
                if (err) {
                    return done(err, false)
                }
                if (user) {
                    return done(undefined, user, jwtToken)
                } else {
                    return done(undefined, false)
                }
            })
        }
    )
)