
import { Types } from 'mongoose';

export type ViewType = '2d' | '3d' | 'section' | 'markup';

export interface View {
  projectId: Types.ObjectId;
  fileId: Types.ObjectId;
  type: ViewType;
  name?: string;
  previewSrc?: string;
  settings?: {
    pageIndex?: number;
    scale?: number;
    rotation?: number;
  };
  createdBy?: string;
  createdAt?: Date;
}