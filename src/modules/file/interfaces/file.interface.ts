import { Document, Types } from "mongoose";

export interface IFileVersion {
  version: number;
  fileName: string;
  storageKey: string;
  location: string;
  size: number;
  mimeType: string;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
}

export interface IFile extends Document {
  name: string;
  folderId: Types.ObjectId | null;
  projectId: Types.ObjectId;
  tags?: Types.ObjectId[];

  currentVersion: number;
  versions: IFileVersion[];

  isLocked: boolean;
  lockedBy?: Types.ObjectId;
  lockedAt?: Date;

  isDeleted: boolean;
  deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
