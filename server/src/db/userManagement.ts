import { Account } from "./userSchema"

export const getUserFromUsername = async (username: string) => {
    return await Account.findOne({ username })
}

export const getUserFromEmail = async (email: string) => {
    return await Account.findOne({ email });
}

//get Doc or Docs function here perhaps?
//--------------------------------------

export const putUser = async (username, email, password, key) => {
    const res = await Account.create({
        username,
        email,
        password,
        verificationKey: key
    });
    return res;
}