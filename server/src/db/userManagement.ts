import { Account } from "./userSchema"

export const getUserFromname = async (name: string) => {
    return await Account.findOne({ name })
}

export const getUserFromEmail = async (email: string) => {
    return await Account.findOne({ email });
}

//get Doc or Docs function here perhaps?
//--------------------------------------

export const putUser = async (name, email, password, key) => {
    const res = await Account.create({
        name,
        email,
        password,
        verificationKey: key
    });
    return res;
}