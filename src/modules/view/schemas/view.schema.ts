import { Schema, model, Types } from "mongoose";
import { IView } from "../interfaces/view.interface";

const ViewSchema = new Schema<IView>(
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

    assignedTo: { type: String },

    annotations: {
      type: String,
      required: true,
    },

    viewportState: {
      zoom: { type: Number, required: true },
      rotate: { type: Number, required: true },
      pageIndex: { type: Number, required: true },
      panX: { type: Number },
      panY: { type: Number },
    },

    previewSrc: { type: String },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  {
    timestamps: true,
  }
);

export const ViewModel = model<IView>("View", ViewSchema);
