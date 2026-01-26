import mongoose, { Document } from "mongoose";

export interface IAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
  fileId?: string; // (Optional)
}

export interface ITodo extends Document {
  title: string;
  description?: string;
  status: "New" | "In Progress" | "Done" | "Closed";
  priority: "high" | "normal" | "low";
  completion: number; // 0-100
  assignees?: string[];
  type:
  | "undefined"
  | "comment"
  | "issue"
  | "request"
  | "fault"
  | "inquiry"
  | "solution"
  | "remark"
  | "clash";
  tags?: string[];
  dueDate?: Date;
  projectId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  items?: {
    fileUrl: string;
    modelId: string;
    expressId: string[];
  }[];
  viewState?: {
    camera: {
      position: number[];
      target: number[];
    };
    visibility: {
      modelID: string | number;
      ids: number[];
    }[];
    selection: {
      modelID: string | number;
      expressID: number;
      fileUrl?: string;
    }[];
    thumbnail?: string; // Base64 string
  };
  attachments?: IAttachment[];
  createdAt: Date;
  updatedAt: Date;
}
