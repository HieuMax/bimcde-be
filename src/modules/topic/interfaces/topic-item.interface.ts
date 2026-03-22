import mongoose from "mongoose";

export interface ITopicStats {
  comments: number;
  viewpoints: number;
  attachments: number;
}

export interface IAttachment {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
  fileId?: string;
}

export interface ITopicItem extends mongoose.Document {
  projectId: mongoose.Types.ObjectId;
  code: string;
  title: string;
  description?: string;

  assignee?: string;
  type:
    | "Undefined"
    | "Comment"
    | "Issue"
    | "Request"
    | "Fault"
    | "Inquiry"
    | "Solution"
    | "Remark"
    | "Clash";
  status: "New" | "In Progress" | "Waiting" | "Done" | "Closed";
  priority: "Low" | "Normal" | "High" | "Critical";

  tags: string[];
  dueDate?: Date;
  authorName: string;
  thumbnailUrl?: string;

  stats: ITopicStats;

  attachments?: IAttachment[];
}
