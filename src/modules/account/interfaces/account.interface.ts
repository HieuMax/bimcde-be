import { Document } from "mongoose";

// Định nghĩa Role type để code chặt chẽ hơn (thay vì chỉ để string)
export type AccountRole = "admin" | "user";

export interface IAccount extends Document {
  fullName: string;
  email: string;
  password: string;
  role: AccountRole;
  phone?: string; // Dấu ? vì required: false (mặc định)

  // 2 trường này tự động có do timestamps: true
  createdAt: Date;
  updatedAt: Date;
}
