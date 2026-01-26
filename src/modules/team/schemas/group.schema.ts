import { Schema, model } from "mongoose";
import { IGroup } from "../interfaces/group.inferfaces";

const groupSchema = new Schema<IGroup>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "projects", // Assuming you have a "projects" model
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  }
);

// Define the model with a unique name "Group" to avoid conflict
const groupModel = model<IGroup>("Group", groupSchema);

export default groupModel;
