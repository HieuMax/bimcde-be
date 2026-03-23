import TodoModel from "../schemas/todo.schema";
import { ITodo } from "../interfaces/todo.interface";

export default class TodoService {
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