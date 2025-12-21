import mongoose, { Schema } from "mongoose";
import { IFolder } from "../interfaces/folder.interface";

const FolderVersionSchema = new Schema(
  {
    version: { type: Number, required: true },
    name: { type: String, required: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: "Account" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const FolderSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
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

    parentId: {
      type: Schema.Types.ObjectId,
      ref: "Folder",
      default: null,
      index: true,
    },

    // Breadcrumb path for tree structure: ",grandparent_id,parent_id,"
    path: { type: String, default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", required: true },

    description: { type: String },

    totalSize: { type: Number, default: 0 },

    currentVersion: { type: Number, default: 1 },
    versions: [FolderVersionSchema],

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

FolderSchema.index(
  { projectId: 1, parentId: 1, name: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);
FolderSchema.index({ parentId: 1, size: 1 });
FolderSchema.index({ parentId: 1, updatedAt: 1 });

export default mongoose.model<IFolder>("Folder", FolderSchema);
