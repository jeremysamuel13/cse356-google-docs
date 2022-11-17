import { Schema, model, ObjectId } from 'mongoose';

export interface IAccount {
    name: string,
    email: string,
    password: string,
    isVerified: boolean,
    verificationKey?: string
}

export const accountSchema = new Schema<IAccount>({
    name: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isVerified: { type: Boolean, required: true, default: false },
    verificationKey: { type: String, required: verificationKeyIsRequired },
});

function verificationKeyIsRequired(this: IAccount) {
    return !this.isVerified
}

export const Account = model<IAccount>('Account', accountSchema)
