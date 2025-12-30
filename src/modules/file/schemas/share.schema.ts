import mongoose, { Schema, Document } from "mongoose";

export interface IShare extends Document {
  fileId: mongoose.Types.ObjectId;
  sharedBy: mongoose.Types.ObjectId;
  type: "SPECIFIC" | "INTERNAL_LINK" | "PUBLIC_LINK";

  // Danh sách người được share (nếu type = SPECIFIC)
  recipients: string[]; // Lưu email hoặc UserId

  // Cấu hình
  accessLevel: "VIEW" | "EDIT" | "DOWNLOAD";
  expiresAt?: Date;
  showLatestVersion: boolean;
  note?: string;

  // Token cho link public (để verify khi truy cập)
  token?: string;

  createdAt: Date;
}

const ShareSchema = new Schema<IShare>(
  {
    fileId: { type: Schema.Types.ObjectId, ref: "File", required: true },
    sharedBy: { type: Schema.Types.ObjectId, ref: "Account", required: true },
    type: {
      type: String,
      enum: ["SPECIFIC", "INTERNAL_LINK", "PUBLIC_LINK"],
      required: true,
    },
    recipients: [{ type: String }], // Email hoặc ID
    accessLevel: { type: String, default: "VIEW" },
    expiresAt: { type: Date },
    showLatestVersion: { type: Boolean, default: false },
    note: { type: String },
    token: { type: String }, // Dùng uuid để generate
  },
  { timestamps: true }
);

export default mongoose.model<IShare>("Share", ShareSchema);
