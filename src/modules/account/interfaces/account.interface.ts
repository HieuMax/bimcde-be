import { Types } from "mongoose";

export interface IAccount {
  fullName: string;
  email: string;
  password: string;
  role: "admin" | "user";
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
  resetPasswordToken?: string;
  resetPasswordExpire?: Date;
  // more....
}

export interface IResetPasswordStorage {
  userId: Types.ObjectId;
  url: string;
  status: "open" | "closed";
}
