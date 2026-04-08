// bimcde-be\src\modules\file\schemas\file.schema.ts
import mongoose, { Schema } from "mongoose";
import { IFile } from "../interfaces/file.interface";
import { CDE_FOLDER_STAGES } from "../../../constants/cde-workflow";

const FileSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    folderId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      required: false,
      default: null,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    tags: [
      {
        type: Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],

    currentVersion: { type: Number, default: 1 },
    versions: [
      {
        version: { type: Number, required: true },
        fileName: { type: String },
        storageKey: { type: String, required: true },
        location: { type: String, required: true },
        size: { type: Number },
        mimeType: { type: String },
        uploadedBy: { type: Schema.Types.ObjectId, ref: "Account" },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    isLocked: { type: Boolean, default: false },
    lockedBy: { type: Schema.Types.ObjectId, ref: "Account" },
    lockedAt: { type: Date },

    /** Primary owner for ISO “member may only edit own content” (falls back to version uploader if unset) */
    createdBy: { type: Schema.Types.ObjectId, ref: "Account" },
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      default: null,
      index: true,
    },
    /** Denormalized CDE container for queries (optional) */
    cdeStage: {
      type: String,
      enum: CDE_FOLDER_STAGES,
    },
    workflowStatus: {
      type: String,
      enum: ["WIP_DRAFT", "SUBMITTED_FOR_REVIEW", "COORDINATED", "PUBLISHED", "ARCHIVED"],
      default: "WIP_DRAFT",
      index: true,
    },
    submittedForReviewAt: { type: Date, default: null },
    submittedForReviewBy: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    submittedForReviewVersion: { type: Number, default: null },
    /** Last WIP file version that was promoted to Shared (WIP→Shared); hide promote until new submit */
    wipPromotedToSharedVersion: { type: Number, default: null },
    /** Shared file: last version promoted to Published; hide Promote to Published until Shared gets a new revision */
    sharedPromotedToPublishedVersion: { type: Number, default: null },
    /** Promote chain: copy in destination points back to WIP source */
    promotedFromFileId: {
      type: Schema.Types.ObjectId,
      ref: "File",
      default: null,
    },
    promotedFromVersion: { type: Number, default: null },
  },
  { 
    timestamps: true,
    collection: "files"
  },
);

FileSchema.index(
  { folderId: 1, name: 1, projectId: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
FileSchema.index({ folderId: 1, size: 1 });
FileSchema.index({ folderId: 1, updatedAt: 1 });
FileSchema.index({ projectId: 1, isDeleted: 1 });

export default mongoose.model<IFile>("File", FileSchema);
// bimcde-be\src\modules\file\schemas\file.schema.ts