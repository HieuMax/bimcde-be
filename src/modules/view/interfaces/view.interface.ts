import { Document, Types } from "mongoose";

// Sub-interfaces cho ViewState
export interface ICamera {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  up: { x: number; y: number; z: number };
  projection: "ORTHO" | "PERSPECTIVE";
  zoom?: number;
}

export interface ISectionPlane {
  position: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
}

export interface IViewState {
  camera: ICamera;
  hiddenElements?: string[]; // Array of GUIDs
  selectedElements?: string[];
  // [FIX] Thêm trường này để khớp với Schema
  coloredElements?: { color: string; elementIds: string[] }[];
  sectionPlanes?: ISectionPlane[];
  markupData?: any; // JSON string or object from Canvas library
}

// Interface chính của Document View
export interface IView extends Document {
  projectId: Types.ObjectId;
  name: string;
  // [FIX] Cho phép null vì Mongoose có thể trả về null
  description?: string | null;
  thumbnailUrl?: string | null;

  type: "3D" | "2D";
  relatedFileId?: Types.ObjectId; // Required if type is 2D

  createdBy: Types.ObjectId;

  sharedWith: {
    isPublic: boolean;
    users: Types.ObjectId[];
  };

  tags?: Types.ObjectId[];

  viewState: IViewState;

  createdAt: Date;
  updatedAt: Date;
}

// DTO cho Create Request
export interface CreateViewDTO {
  projectId: string;
  name: string;
  description?: string;
  thumbnailUrl?: string;
  type: "3D" | "2D";
  relatedFileId?: string;
  viewState: IViewState;
  sharedWith?: {
    isPublic?: boolean;
    users?: string[];
  };
  /** Tag document ids */
  tags?: string[];
}
