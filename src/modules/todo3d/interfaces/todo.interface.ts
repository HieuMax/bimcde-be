import mongoose, { Document, Types } from "mongoose";

export interface IAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
  fileId?: string; // (Optional)
}

export interface IModelTransform {
  modelID: number;
  fileUrl: string;
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: number;
}

export interface IClippingPlane {
  normal: number[]; // [x, y, z]
  constant: number;
}

export interface IAssigness {
  assigneeId?: Types.ObjectId;
  name: string;
  type: string;
  label: string;
}

export interface ITag {
  tagId: Types.ObjectId;
  name: string;
}

export interface ITodo extends Document {
  title: string;
  description?: string;
  status: "New" | "In Progress" | "Done" | "Closed";
  priority: "high" | "normal" | "low";
  completion: number; // 0-100
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
  dueDate?: Date;
  projectId: mongoose.Types.ObjectId;
  /** Parent TopicItem (optional; same collection as BCF topics). */
  topicId?: mongoose.Types.ObjectId | null;
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
    modelOpacity?: number;
    modelTransforms?: IModelTransform[];
    clippingPlanes?: IClippingPlane[];
  };
  attachments?: IAttachment[];
  assignees: IAssigness[];
  tags: ITag[];
  createdAt: Date;
  updatedAt: Date;
}
