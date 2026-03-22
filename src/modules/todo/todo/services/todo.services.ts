import { Types } from "mongoose";
import projectMemberSchema from "../../../project/schemas/project-member.schema";
import todoModel from "../schemas/todo.schema";
import { ITodo } from "../interfaces/todo.inferfaces";

export default class TodoService {
  async getAllTodo(projectId: string, userId: Types.ObjectId | undefined) {
    if (!userId) {
      throw new Error("User không hợp lệ.");
    }

    const member = await projectMemberSchema.findOne({
      userId: userId,
      projectId: projectId,
    });

    if (!member) {
      throw new Error("Bạn không có quyền truy cập vào dự án này.");
    }

    const result = await todoModel.find({ projectId: projectId });

    return result;
  }

  async createTodo(
    projectId: string,
    userId: Types.ObjectId | undefined,
    data: ITodo,
  ) {
    try {
      if (!userId) {
        throw new Error("User không hợp lệ.");
      }

      const member = await projectMemberSchema.findOne({
        userId: userId,
        projectId: projectId,
      });

      if (!member) {
        throw new Error("Bạn không có quyền truy cập vào dự án này.");
      }

      const result = await todoModel.create({
        ...data,
      });

      return result;
    } catch (err) {
      throw err;
    }
  }

  async updateTodo(
    userId: Types.ObjectId | undefined,
    todoId: string,
    updateData: Partial<ITodo>,
  ) {
    try {
      if (!userId) {
        throw new Error("User không hợp lệ.");
      }

      const todo = await todoModel.findById(todoId);
      if (!todo) {
        throw new Error("Todo không tồn tại.");
      }
      const projectId = todo.projectId;

      const member = await projectMemberSchema.findOne({
        userId: userId,
        projectId: projectId,
      });
      if (!member) {
        throw new Error("Bạn không có quyền truy cập vào dự án này.");
      }
      const updatedTodo = await todoModel.findByIdAndUpdate(
        todoId,
        {
          $set: {
            ...updateData,
            modifiedOn: new Date(),
          },
        },
        {
          new: true,
          runValidators: true, 
        },
      );

      return updatedTodo;
    } catch (err) {
      throw err;
    }
  }

  async deleteTodo(todoId: string, userId: Types.ObjectId | undefined) {
    try {
      if (!userId) {
        throw new Error("User không hợp lệ.");
      }
      const todo = await todoModel.findById(todoId);
      if (!todo) {
        throw new Error("Todo không tồn tại.");
      }
      const projectId = todo.projectId;

      const member = await projectMemberSchema.findOne({
        userId: userId,
        projectId: projectId,
      });
      if (!member) {
        throw new Error("Bạn không có quyền truy cập vào dự án này.");
      }

      await todoModel.findByIdAndDelete(todoId);

      return { message: "Xóa todo thành công." };
    } catch (err) {
      throw err;
    }
  }
}
