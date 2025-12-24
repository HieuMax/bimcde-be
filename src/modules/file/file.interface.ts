
import { Types } from 'mongoose';

export type FileType = 'PDF' | 'IMAGE' | 'WORD';

export interface FileItem {
  projectId: Types.ObjectId;
  name: string;
  fileType: FileType;
  fileUrl: string; 
  previewSrc?: string;
  size?: number;
  mimeType?: string;
  sourceExplorerId?: Types.ObjectId;
  createdBy?: string;
  createdAt?: Date;
  updatedAt?: Date;
}