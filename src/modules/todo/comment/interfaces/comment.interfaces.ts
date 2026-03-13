import { Types } from "mongoose";

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
  hasAttachments: boolean;
}
