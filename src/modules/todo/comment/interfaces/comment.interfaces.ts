import { Types } from "mongoose";

interface IAttachment {
  name: string;
  url: string;
  mimeType: string;
  size: number;
  location: string;
  fileId?: string;
}

export interface ICommentTodo {
  todoId: Types.ObjectId;
  description: string;
  createdBy: {
    userId: Types.ObjectId;
    fullName: string;
    email: string;
    role: string;
  };
  createdOn: Date;
  modifiedBy: {
    userId: Types.ObjectId;
    fullName: string;
    email: string;
    role: string;
  };
  modifiedOn: Date;
  attachments: IAttachment[];
}
