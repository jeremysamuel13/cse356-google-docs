import { Account } from "./userSchema.ts"

export const getUserFromUsername = async (username: string) => {
    return await User.findOne({ username })
}

export const getUserFromEmail = async (email: string) => {
    return await User.findOne({ email });
}

//get Doc or Docs function here perhaps?
//--------------------------------------

export const putUser = async (username, email, password, key) => {
    const res = await User.create({
        username,
        email,
        password,
        docs: [],
        verificationKey: key
    });
    return res;
}