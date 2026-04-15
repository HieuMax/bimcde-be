import { Document, Types } from "mongoose";

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
  hiddenElements?: string[]; 
  selectedElements?: string[];
  coloredElements?: { color: string; elementIds: string[] }[];
  sectionPlanes?: ISectionPlane[];
  markupData?: any; 
}
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
  
  viewState?: IViewState;

  // Metadata
  isDeleted: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateView2DDTO {
  name: string;
  description?: string;
  projectId: string;
  fileId: string;
  createdBy: string;
  assignedTo?: string;
  
  pageIndex?: number;
  scale?: number;
  rotation?: number;
  previewSrc?: string;
  viewState?: IViewState;
}