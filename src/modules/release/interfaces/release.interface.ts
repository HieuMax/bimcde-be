import { Document, Types } from "mongoose";

export interface IReleaseItem {
  fileId: Types.ObjectId;
  version: number; // Quan trọng: Release phải trỏ đến version cụ thể
  name: string; // Snapshot tên file lúc release
  size?: number;
  mimeType?: string;
  location?: string;
  modifiedBy?: string;
  modifiedById?: Types.ObjectId;
  updatedAt?: Date;
  tags?: { name: string; color: string }[];
}

export interface IRelease extends Document {
  projectId: Types.ObjectId;
  name: string;
  description?: string;

  status: "DRAFT" | "RELEASED";

  // Danh sách file trong gói này
  items: IReleaseItem[];

  createdBy: Types.ObjectId;
  /** Set when status becomes RELEASED (kept for backward compatibility with existing data). */
  sentAt?: Date;
  dueDate?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// DTO cho Create/Update
export interface CreateReleaseDTO {
  projectId: string;
  name: string;
  description?: string;
  items: { fileId: string; version?: number }[]; // Nếu không truyền version, mặc định lấy mới nhất
  dueDate?: Date;
}
