import { model, Schema } from "mongoose";
import { ICommentTodo } from "../interfaces/comment.interfaces";

const commentTodoSchemas = new Schema<ICommentTodo>({
  todoId: {
    type: Schema.Types.ObjectId,
    ref: "Todo",
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  createdBy: {
    type: {
      fullName: String,
      userId: String,
      email: String,
      role: String,
    },
    default: null,
  },
  createdOn: {
    type: Date,
    default: Date.now,
  },
  modifiedBy: {
    type: {
      fullName: String,
      userId: String,
      email: String,
      role: String,
    },
    default: null,
  },
  modifiedOn: {
    type: Date,
  },
  hasAttachments: {
    type: Boolean,
  },
});

const commentTodoModel = model<ICommentTodo>("CommentTodo", commentTodoSchemas);

export default commentTodoModel;
