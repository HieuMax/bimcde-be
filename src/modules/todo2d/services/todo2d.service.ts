import TodoModel from "../schemas/todo2d.schema";
import { ITodo } from "../interfaces/todo2d.interface";

export default class Todo2DService {
  // Tạo Todo mới
  async createTodo(data: Partial<ITodo>) {
    return await TodoModel.create(data);
  }

  // Lấy danh sách Todo theo File
  async getTodosByFile(fileId: string) {
    return await TodoModel.find({ fileId, isDeleted: false })
      .sort({ createdAt: -1 });
  }

  // Cập nhật Todo
  async updateTodo(id: string, data: Partial<ITodo>) {
    return await TodoModel.findByIdAndUpdate(id, data, { new: true });
  }

  // Xóa
  async deleteTodo(id: string) {
    return await TodoModel.findByIdAndDelete(id);
  }
}