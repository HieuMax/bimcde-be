import { Types } from "mongoose";

export interface IAttachment {
  name: string;
  todoId: Types.ObjectId;
  url: string;
  mimeType: string;
  size: number;
  fileId?: string;
}
