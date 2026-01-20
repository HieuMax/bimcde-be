import { Document, Types } from "mongoose";

/** Trạng thái viewport */
export interface IViewportState {
  zoom: number;
  rotate: number;
  pageIndex: number;
  panX?: number;
  panY?: number;
}

/** View document */
export interface IView extends Document {
  name: string;
  description?: string;

  projectId: Types.ObjectId;
  fileId: Types.ObjectId;

  createdBy: Types.ObjectId;
  assignedTo?: string;

  annotations: string;
  viewportState: IViewportState;
  previewSrc?: string;

  isDeleted: boolean;
  deletedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}

/** DTO tạo View */
export interface CreateView {
  name: string;
  description?: string;
  projectId: string;
  fileId: string;
  userId: string;

  annotations: string;
  viewportState: IViewportState;
  previewSrc?: string;
  assignedTo?: string;
}
