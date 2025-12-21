import { model, Schema } from "mongoose";
import { IProject } from "../interfaces/project.interfaces";

const projectSchema = new Schema<IProject>(
  {
    name: {
      type: String,
      required: [true, "Project name is required"],
      maxLength: [100, "Project name must be less than 100 characters"],
    },
    description: {
      type: String,
      maxLength: [500, "Description must be less than 500 characters"],
    },
    createdBy: {
      type: Object,
      required: [true, "Creator is required"],
      default: {},
    },
    modifiedBy: {
      type: Object,
      default: {},
    },
    lastVisitedOn: {
      type: Date,
    },
    size: {
      type: String,
      default: "0 MB",
    },
    filesCount: {
      type: Number,
      default: 0,
    },
    folderCount: {
      type: Number,
      default: 0,
    },
    startDate: {
      type: Date,
      default: null,
    },
    endDate: {
      type: Date,
      default: null,
    },
    lastModifiedOn: {
      type: Date,
    },

    thumbnail: {
      type: String,
    },
  },
  { timestamps: true }
);

export default model<IProject>("Project", projectSchema);
