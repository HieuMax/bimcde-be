import mongoose, { Document } from "mongoose";

export interface ITodo extends Document {
  title: string;
  description?: string;
  status: "New" | "In Progress" | "Done" | "Closed";
  priority: "high" | "normal" | "low";
  completion: number; // 0-100
  assignees?: string[];
  type:
    | "undefined"
    | "comment"
    | "issue"
    | "request"
    | "fault"
    | "inquiry"
    | "solution"
    | "remark"
    | "clash";
  tags?: string[];
  dueDate?: Date;
  projectId: mongoose.Types.ObjectId;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
