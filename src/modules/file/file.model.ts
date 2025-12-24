
import { Schema, model, Document } from 'mongoose';

export interface IFile extends Document {
  projectId: Schema.Types.ObjectId;
  name: string;
  fileType: 'PDF' | 'IMAGE' | 'WORD';
  fileUrl: string;
  mimeType: string;
  size: number;
  metadata?: {
    pageCount?: number;
    width?: number;
    height?: number; 
  };
  createdBy: string;
}

const FileSchema = new Schema({
  projectId: { type: Schema.Types.ObjectId, ref: 'Project', required: true, index: true }, // Index here
  name: { type: String, required: true },
  fileType: { type: String, enum: ['PDF', 'IMAGE', 'WORD'], required: true },
  fileUrl: { type: String, required: true },
  mimeType: String,
  size: Number,
  metadata: {
    pageCount: Number,
    width: Number,
    height: Number
  },
  createdBy: String,
}, { timestamps: true });

export const FileModel = model<IFile>('File', FileSchema);