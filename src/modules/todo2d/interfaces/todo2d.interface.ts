import { Document, Types } from "mongoose";

export interface ITodo extends Document {
  title: string;
  description?: string;
  
  status: "Open" | "In Progress" | "Done" | "Closed";
  priority: "Low" | "Normal" | "High" | "Critical";
  type: string; // Issue, Question, Defect...
  
  dueDate?: Date;
  completion: number; // 0 - 100
  assignee?: string; // Backward compatibility: single assignee
  assignees?: string[]; // NEW: Multiple assignees
  tags: string[];

  // Quan hệ
  projectId: string;
  fileId: string;
  topicId?: Types.ObjectId | null;
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