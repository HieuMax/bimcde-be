import { Document, Types } from "mongoose";

export interface ITodo extends Document {
  title: string;
  description?: string;
  
  // Enum phải khớp với Schema và FE
  status: "Open" | "In Progress" | "Done" | "On Hold";
  priority: "Low" | "Normal" | "High" | "Urgent";
  type: string; // Issue, Question, Defect...
  
  dueDate?: Date;
  completion: number; // 0 - 100
  assignee?: string;
  tags: string[];

  // Quan hệ
  projectId: string;
  fileId: string;
  viewId?: string;

  position?: {
    x: number;
    y: number;
    pageIndex: number;
  };

  createdBy?: string;
  updatedBy?: string; 
  userId?: Types.ObjectId;
  isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}