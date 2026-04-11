import mongoose, { Schema } from "mongoose";
import { IView } from "../interfaces/view2d.interface";

const View2DSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },

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
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },

    sharedWith: {
      isPublic: { type: Boolean, default: false },
      users: [
        {
          userId: { type: Schema.Types.ObjectId, ref: "Account" },
          fullName: { type: String },
          email: { type: String },
          label: { type: String },
          type: { type: String, enum: ["USER", "GROUP"], default: "USER" },
        },
      ],
    },

    // View state
    pageIndex: { type: Number, default: 1 },
    scale: { type: Number, default: 1 },
    rotation: { type: Number, default: 0 },
    previewSrc: { type: String, default: null },

    isDeleted: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    collection: "views",
  }
);

export default mongoose.model<IView>("View2D", View2DSchema);