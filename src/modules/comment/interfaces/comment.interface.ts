import mongoose, { Document } from "mongoose";

export interface IComment extends Document {
  content: string;
  targetId: mongoose.Types.ObjectId;
  targetType: "file" | "folder" | "release" | "view" | "topic";
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
