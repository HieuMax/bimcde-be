import mongoose, { Schema } from "mongoose";
import { IComment } from "../interfaces/comment.interface";

const CommentSchema = new Schema<IComment>(
  {
    content: { type: String, required: true, trim: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    targetType: {
      type: String,
      enum: ["file", "folder", "release", "view", "topic"],
      required: true,
      trim: true,
    },
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", required: true },
  },
  { timestamps: true }
);

CommentSchema.index({ targetId: 1, targetType: 1, createdAt: -1 });
CommentSchema.index({ createdBy: 1 });

const CommentModel = mongoose.model<IComment>("Comment", CommentSchema);
export default CommentModel;
