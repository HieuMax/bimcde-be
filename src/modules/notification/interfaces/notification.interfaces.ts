import { Types } from "mongoose";

export interface INotification {
  userId: Types.ObjectId;
  title: string;
  content: string;
  isRead: boolean;
}
