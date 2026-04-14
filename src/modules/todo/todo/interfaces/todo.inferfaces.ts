// import { Types } from "mongoose";

// interface IPriority {
//   priorityId: Types.ObjectId;
//   name: string;
//   color: string;
// }

// export interface IAssigness {
//   assigneeId?: Types.ObjectId;
//   name: string;
//   type: string;
//   label: string;
// }

// interface ITag {
//   tagId: Types.ObjectId;
//   name: string;
// }

// interface IType {
//   typeId: Types.ObjectId;
//   name: string;
// }

// interface ICreatdBy {
//   fullName: string;
//   userId: Types.ObjectId;
//   email: string;
//   role: string;
// }

// export interface ITodo {
//   projectId: Types.ObjectId;
//   name: string;
//   description: string;
//   priority: IPriority;
//   assignees: IAssigness[];
//   typeTopic: IType | null;
//   tag: ITag[];
//   dueDate: Date;
//   createOn: Date;
//   modifiedOn: Date;
//   status: string;
//   completion: number;
//   createdBy: ICreatdBy;
//   modifiedBy: ICreatdBy;
// }

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
export interface IPriority {
  priorityId: Types.ObjectId;
  name: string;
  color: string;
}

export interface IType {
  typeId: Types.ObjectId;
  name: string;
}

export interface ITodo extends Document {
  title: string;
  description?: string;
  status: string;
  priority: IPriority;
  completion: number; // 0-100
  type: IType;
  dueDate?: Date;
  projectId: mongoose.Types.ObjectId;
  topicItemId?: mongoose.Types.ObjectId | null;
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
