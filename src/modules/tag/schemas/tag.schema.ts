import mongoose, { Schema, Document } from "mongoose";

export interface ITag extends Document {
  name: string;
  color: string;
  projectId: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const TagSchema: Schema = new Schema(
  {
    name: { type: String, required: true },
    color: { type: String, default: "#000000" }, // Hex color
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
  },
  { timestamps: true }
);

// Ensure unique tag name per project
TagSchema.index({ projectId: 1, name: 1 }, { unique: true });

export default mongoose.model<ITag>("Tag", TagSchema);
