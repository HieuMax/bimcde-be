import mongoose, { Schema } from "mongoose";
import { IView } from "../interfaces/file.interface"; // Import từ file interface chung

const ViewSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String },

    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    fileId: {
      type: Schema.Types.ObjectId,
      ref: "File",
      required: true,
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    assignedTo: { type: String, default: "Private" },

    annotations: { type: String, default: "[]" },

    viewportState: {
      zoom: { type: Number, default: 1 },
      rotate: { type: Number, default: 0 },
      pageIndex: { type: Number, default: 1 },
      panX: { type: Number, default: 0 },
      panY: { type: Number, default: 0 },
    },

    previewSrc: { type: String },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

ViewSchema.index({ fileId: 1, isDeleted: 1 });

export default mongoose.model<IView>("View", ViewSchema);