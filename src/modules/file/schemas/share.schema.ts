import mongoose, { Schema, Document, Types } from "mongoose";

export type ShareType = "SPECIFIC" | "INTERNAL_LINK" | "PUBLIC_LINK";
export type ShareAccessLevel = "VIEW" | "EDIT" | "DOWNLOAD";

export interface IShare extends Document {
  shareId: string;
  projectId: mongoose.Types.ObjectId;
  fileId: mongoose.Types.ObjectId;
  sharedBy?: mongoose.Types.ObjectId;
  type: ShareType;
  recipients: string[];
  accessLevel: ShareAccessLevel;
  expiresAt?: Date; 
  showLatestVersion: boolean;
  note?: string;
  token?: string;
  createdAt: Date;
}

const ShareSchema = new Schema<IShare>(
  {
    shareId: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
    projectId: {
      type:mongoose.Schema.Types.ObjectId, ref: "Project", required: true
    },
    fileId: { type: Schema.Types.ObjectId, ref: "File", required: true },
    sharedBy: { type: Schema.Types.ObjectId, ref: "Account", required: false },
    type: {
      type: String,
      enum: ["SPECIFIC", "INTERNAL_LINK", "PUBLIC_LINK"],
      required: true,
    },
    recipients: { type: [String], default: [] },
    accessLevel: {
      type: String,
      enum: ["VIEW", "EDIT", "DOWNLOAD"],
      default: "VIEW",
    },
    expiresAt: { type: Date, default: null }, 
    showLatestVersion: { type: Boolean, default: false },
    note: String,
    token: { type: String, index: true },
  },
  { timestamps: true }
);

export default mongoose.model<IShare>("Share", ShareSchema);
