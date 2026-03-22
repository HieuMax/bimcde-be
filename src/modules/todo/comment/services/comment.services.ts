import { Types } from "mongoose";
import CommentModel from "../../../comment/schemas/comment.schema";
import todoModel from "../../todo/schemas/todo.schema";
import { ICommentTodo } from "../interfaces/comment.interfaces";
import commentTodoModel from "../schemas/comment.schemas";

export default class TodoCommentService {
  async getComment(todoId: string) {
    const result = await commentTodoModel.find({ todoId: todoId });
    return result;
  }

  async createComment(data: ICommentTodo) {
    const todo = await todoModel.findById(data.todoId).sort({ createOn: 1 });
    if (!todo) {
      throw new Error("Todo không tồn tại.");
    }

    const result = await commentTodoModel.create({
      ...data,
    });
    return result;
  }

  async updateComment(commentId: string, updateData: any) {
    const comment = await commentTodoModel.findById(commentId);
    if (!comment) {
      throw new Error("Comment không tồn tại.");
    }

    const result = await commentTodoModel.findByIdAndUpdate(
      commentId,
      updateData,
      {
        new: true,
      },
    );
    return result;
  }

  async deleteComment(commentId: string) {
    const comment = await commentTodoModel.findById(commentId);
    if (!comment) {
      throw new Error("Comment không tồn tại.");
    }

    const result = await commentTodoModel.findByIdAndDelete(commentId);
    return result;
  }
}
