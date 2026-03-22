import mongoose, { Schema } from "mongoose";
import { IRelease } from "../interfaces/release.interface";

const ReleaseItemSchema = new Schema(
  {
    fileId: { type: Schema.Types.ObjectId, ref: "File", required: true },
    version: { type: Number, required: true },
    name: { type: String, required: true },
    size: { type: Number, default: 0 },
    mimeType: { type: String },
    location: { type: String },
    modifiedBy: { type: String, default: "Unknown" },
    modifiedById: { type: Schema.Types.ObjectId, ref: "Account" },
    updatedAt: { type: Date, default: Date.now },
    tags: [
      {
        name: { type: String },
        color: { type: String },
      },
    ],
  },
  { _id: false },
);

const ReleaseSchema = new Schema<IRelease>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    name: { type: String, required: true },
    description: { type: String },

    status: {
      type: String,
      enum: ["DRAFT", "SENT"],
      default: "DRAFT",
      index: true,
    },

    items: [ReleaseItemSchema],

    recipients: [{ type: Schema.Types.ObjectId }],

    createdBy: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    sentAt: { type: Date },
    dueDate: { type: Date },
  },
  { timestamps: true },
);

// Index để tìm kiếm nhanh
ReleaseSchema.index({ projectId: 1, status: 1 });
ReleaseSchema.index({ createdBy: 1 });

export default mongoose.model<IRelease>("Release", ReleaseSchema);
