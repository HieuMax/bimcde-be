import mongoose, { Schema } from "mongoose";
import { IAttachment } from "../interfaces/attachment.interface";

const AttachmentSchema = new Schema<IAttachment>(
  {
    name: { type: String, required: [true, "Name is required"] },
    todoId: {
      type: Schema.Types.ObjectId,
      ref: "todos",
      required: [true, "Todo ID is required"],
    },
    url: { type: String, required: [true, "URL is required"] },
    mimeType: { type: String },
    location: { type: String },
    size: { type: Number },
    fileId: { type: String },
  },
  { timestamps: true },
);

AttachmentSchema.index({ todoId: 1 });
AttachmentSchema.index({ fileId: 1 });

const AttachmentModel = mongoose.model<IAttachment>(
  "Attachment",
  AttachmentSchema,
);
export default AttachmentModel;
