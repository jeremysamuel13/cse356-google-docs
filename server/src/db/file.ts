import { Schema, model } from 'mongoose';

export interface IFile {
    mimetype: string,
    mediaid: string,
    filepath: string
}

export const fileSchema = new Schema<IFile>({
    mimetype: { type: String, required: true },
    mediaid: { type: String, required: true, unique: true }
});

export const File = model<IFile>('File', fileSchema)
