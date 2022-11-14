import { Schema, model, ObjectId } from 'mongoose';

export interface Account {
    username: string,
    password: string,
    password: string,
    isVerified: boolean,
    verificationKey?: string,
    docs: Array<ObjectId>
}

const accountSchema = new Schema<Account>({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    isVerified: { type: Boolean, required: true, default: false },
    verificationKey: { type: String, required: verificationKeyIsRequired },
    docs: { type: [{ type: Schema.Types.ObjectId, ref: 'Doc' }] }
});