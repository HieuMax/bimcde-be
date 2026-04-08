import { Schema, model } from "mongoose";
import { IItemAcl } from "../interfaces/item-acl.interface";

const ACCESS_LEVELS = ["FULL", "READ_ONLY", "NO_ACCESS"] as const;
const SUBJECT_TYPES = ["USER", "GROUP"] as const;

const ItemAclGrantSchema = new Schema(
  {
    subjectType: { type: String, enum: SUBJECT_TYPES, required: true },
    subjectId: { type: Schema.Types.ObjectId, required: true },
    access: { type: String, enum: ACCESS_LEVELS, required: true },
  },
  { _id: false }
);

const itemAclSchema = new Schema<IItemAcl>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    resourceType: {
      type: String,
      enum: ["folder", "file"],
      required: true,
    },
    resourceId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    defaultAccess: {
      type: String,
      enum: ACCESS_LEVELS,
      default: "FULL",
    },
    inheritFromParent: {
      type: Boolean,
      default: true,
    },
    grants: { type: [ItemAclGrantSchema], default: [] },
  },
  { timestamps: true, collection: "item_acls" }
);

itemAclSchema.index(
  { projectId: 1, resourceType: 1, resourceId: 1 },
  { unique: true }
);

const itemAclModel = model<IItemAcl>("ItemAcl", itemAclSchema);

export default itemAclModel;
