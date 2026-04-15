import { Document, Types } from "mongoose";
import type { CdeFolderStage } from "../../../constants/cde-workflow";

export interface IFolderVersion {
  version: number;
  name: string;
  updatedBy?: Types.ObjectId;
  createdAt: Date;
}

export interface IFolder extends Document {
  _id: Types.ObjectId;
  name: string;
  projectId: Types.ObjectId;
  parentId: Types.ObjectId | null;
  path: string | null;
  createdBy: Types.ObjectId;
  currentVersion: number;
  versions: IFolderVersion[];
  isDeleted: boolean;
  deletedAt?: Date;
  description?: string;
  tags: string[];
  totalSize: number;
  cdeStage?: CdeFolderStage;
  isCdeRoot?: boolean;
  isCdeRootLocked?: boolean;
  groupId?: Types.ObjectId | null;
  isoRevokeOriginalParentId?: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}
