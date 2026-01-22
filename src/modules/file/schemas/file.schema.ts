// bimcde-be\src\modules\file\schemas\file.schema.ts
import mongoose, { Schema } from "mongoose";
import { IFile } from "../interfaces/file.interface";

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