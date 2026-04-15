import { Document, Types } from "mongoose";
import type { CdeFolderStage } from "../../../constants/cde-workflow";

export interface IFileVersion {
  version: number;
  fileName: string;
  storageKey: string;
  location: string;
  size: number;
  mimeType: string;
  uploadedBy: Types.ObjectId;
  createdAt: Date;
}

export interface IFile extends Document {
  name: string;
  folderId: Types.ObjectId | null;
  projectId: Types.ObjectId;
  project: Types.ObjectId;
  tags?: Types.ObjectId[];
  path?: string;
  mimeType: string;

  currentVersion: number;
  versions: IFileVersion[];

  isLocked: boolean;
  lockedBy?: Types.ObjectId;
  lockedAt?: Date;

  isDeleted: boolean;
  deletedAt?: Date;

  createdBy?: Types.ObjectId;
  groupId?: Types.ObjectId | null;
  cdeStage?: CdeFolderStage;
  workflowStatus?: "WIP_DRAFT" | "SUBMITTED_FOR_REVIEW" | "COORDINATED" | "PUBLISHED" | "ARCHIVED";
  submittedForReviewAt?: Date | null;
  submittedForReviewBy?: Types.ObjectId | null;
  submittedForReviewVersion?: number | null;
  /** WIP source: last version promoted to Shared via leader action */
  wipPromotedToSharedVersion?: number | null;
  /** Shared copy: last revision promoted to Published (Shared→Published) */
  sharedPromotedToPublishedVersion?: number | null;
  promotedFromFileId?: Types.ObjectId | null;
  promotedFromVersion?: number | null;
  isoRevokeOriginalFolderId?: Types.ObjectId | null;
  isoRevokeOriginalName?: string | null;

  createdAt: Date;
  updatedAt: Date;
}
