import express from "express";
import { authenticate } from "../../../../middlewares/authMiddlewares";
import TodoService from "../services/todo.services";

const TodoController = express.Router();

const teamService = new TodoService();

TodoController.get("/getAll/:projectId", authenticate, async (req, res) => {
  try {
    const result = await teamService.getAllTodo(
      req.params.projectId,
      req.userId,
    );
    res.status(200).json({
      success: true,
      message: "Lấy danh sách todo thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi tạo lấy danh sách todo.",
      error: error.message,
    });
  }
});

TodoController.post("/create/:projectId", authenticate, async (req, res) => {
  try {
    const result = await teamService.createTodo(
      req.params.projectId,
      req.userId,
      req.body.data,
    );
    res.status(200).json({
      success: true,
      message: "Tạo todo thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi tạo mới todo.",
      error: error.message,
    });
  }
});

TodoController.post("/update/:todoId", authenticate, async (req, res) => {
  try {
    const result = await teamService.updateTodo(
      req.userId,
      req.params.todoId,
      req.body,
    );
    res.status(200).json({
      success: true,
      message: "Cập nhật todo thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi cập nhật todo.",
      error: error.message,
    });
  }
});

TodoController.delete("/delete/:todoId", authenticate, async (req, res) => {
  try {
    const result = await teamService.deleteTodo(req.params.todoId, req.userId);
    res.status(200).json({
      success: true,
      message: "Xoá todo thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi Xoá todo.",
      error: error.message,
    });
  }
});

export { TodoController };
