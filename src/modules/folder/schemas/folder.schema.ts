// bimcde-be\src\modules\folder\schemas\folder.schema.ts
import mongoose, { Schema } from "mongoose";
import { IFolder } from "../interfaces/folder.interface";
import { CDE_FOLDER_STAGES } from "../../../constants/cde-workflow";

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

    /** Set only on the four CDE root folders (WIP / Shared / Published / Archived) */
    cdeStage: {
      type: String,
      enum: CDE_FOLDER_STAGES,
    },
    /** True for the auto-created 1–4 root folders */
    isCdeRoot: { type: Boolean, default: false, index: true },
    /** ISO mode: root folders cannot be renamed/deleted; Normal: typically false */
    isCdeRootLocked: { type: Boolean, default: false },
    /** ISO: group-owned subtree under WIP/Shared */
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      default: null,
      index: true,
    },
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
