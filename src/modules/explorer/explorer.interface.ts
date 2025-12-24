
import { Types } from 'mongoose';

export type ExplorerItemType = 'folder' | 'file';

export interface ExplorerItem {
  projectId: Types.ObjectId;
  parentId?: Types.ObjectId | null;
  name: string;
  type: ExplorerItemType;
  fileId?: Types.ObjectId;
  previewSrc?: string;
  size?: number;
  createdBy?: string;
  createdAt?: Date;
}