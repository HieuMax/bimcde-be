import { Document, Types } from "mongoose";

export interface IView extends Document {
  name: string;
  description?: string;
  
  projectId: Types.ObjectId;
  fileId: Types.ObjectId;
  createdBy: Types.ObjectId | { _id: string; fullName: string; email: string };
  updatedBy?: Types.ObjectId | { _id: string; fullName: string; email: string };

  assignedTo?: Types.ObjectId;
  
  pageIndex: number;
  scale: number;
  rotation: number;
  previewSrc?: string;

  sharedWith?: {
    isPublic?: boolean;
    users?: Array<
      | Types.ObjectId
      | {
          _id?: string;
          fullName?: string;
          email?: string;
          label?: string;
          type?: string;
        }
    >;
  };
  
  // Metadata
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}