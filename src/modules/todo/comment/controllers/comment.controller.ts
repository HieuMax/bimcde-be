import express from "express";
import TodoCommentService from "../services/comment.services";
import { authenticate } from "../../../../middlewares/authMiddlewares";

const TodoCommentController = express.Router();
const todoCommentService = new TodoCommentService();

TodoCommentController.get("/getComment/:todoId", authenticate, async (req, res) => {
  try {
    const result = await todoCommentService.getComment(req.params.todoId);
    res.status(200).json({
      success: true,
      message: "Lấy danh sách comment thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi tạo lấy danh sách comment.",
      error: error.message,
    });
  }
});

TodoCommentController.post("/createComment/:todoId", authenticate, async (req, res) => {
  try {
    const result = await todoCommentService.createComment({
      ...req.body,
    });
    res.status(200).json({
      success: true,
      message: "Tạo comment thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi tạo mới comment.",
      error: error.message,
    });
  }
});

TodoCommentController.post("/update/:commentId", authenticate, async (req, res) => {
  try {
    const result = await todoCommentService.updateComment(
      req.params.commentId,
      req.body,
    );
    res.status(200).json({
      success: true,
      message: "Cập nhật comment thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi cập nhật comment.",
      error: error.message,
    });
  }
});

TodoCommentController.delete("/delete/:commentId", authenticate, async (req, res) => {
  try {
    const result = await todoCommentService.deleteComment(req.params.commentId);
    res.status(200).json({
      success: true,
      message: "Xóa comment thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi xóa comment.",
      error: error.message,
    });
  }
});
export default TodoCommentController;
