import { Document, Types } from "mongoose";

export interface IReleaseItem {
  fileId: Types.ObjectId;
  version: number; // Quan trọng: Release phải trỏ đến version cụ thể
  name: string; // Snapshot tên file lúc release
  size?: number;
  mimeType?: string;
  location?: string;
  modifiedBy?: string;
  updatedAt?: Date;
  tags?: { name: string; color: string }[];
}

export interface IRelease extends Document {
  projectId: Types.ObjectId;
  name: string;
  description?: string;

  status: "DRAFT" | "SENT";

  // Danh sách file trong gói này
  items: IReleaseItem[];

  // Người nhận (User trong hệ thống)
  recipients: Types.ObjectId[];

  createdBy: Types.ObjectId;
  sentAt?: Date; // Thời điểm chuyển sang SENT
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
  recipients?: string[];
  dueDate?: Date;
}
