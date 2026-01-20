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

export interface IViewportState {
  zoom: number;
  rotate: number;
  pageIndex: number;
  panX?: number;
  panY?: number;
}

export interface IView extends Document {
  name: string;
  description?: string;
  
  // Quan hệ
  projectId: Types.ObjectId;
  fileId: Types.ObjectId; // Link tới File cha
  
  createdBy: Types.ObjectId;
  assignedTo?: string; // Shared with

  // Core Data
  annotations: string; // JSON String
  viewportState: IViewportState;
  previewSrc?: string; // Base64

  isDeleted: boolean;
  deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
