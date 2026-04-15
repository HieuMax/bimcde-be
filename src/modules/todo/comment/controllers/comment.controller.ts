import express from "express";
import TodoCommentService from "../services/comment.services";
import { authenticate } from "../../../../middlewares/authMiddlewares";
import TodoModel from "../../todo/schemas/todo.schema";
import commentTodoModel from "../schemas/comment.schemas";
import {
  actorFromReq,
  logActivitySafe,
  projectIdToString,
} from "../../../activity/utils/auditActivity.helpers";

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
    const actor = actorFromReq(req);
    const todo = await TodoModel.findById(req.params.todoId)
      .select("projectId title")
      .lean();
    if (actor && todo?.projectId && result?._id) {
      await logActivitySafe({
        projectId: projectIdToString(todo.projectId),
        actor,
        actionGroup: "COMMENT",
        actionType: "CREATE",
        target: {
          itemId: String(result._id),
          itemModel: "Comment",
          itemName: "Todo comment",
        },
        description: `Comment on todo "${String(todo.title ?? "")}"`,
        metaData: { todoId: req.params.todoId },
      });
    }
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
    const actor = actorFromReq(req);
    const prev = result?.todoId
      ? await TodoModel.findById(result.todoId).select("projectId title").lean()
      : null;
    if (actor && prev?.projectId && result?._id) {
      await logActivitySafe({
        projectId: projectIdToString(prev.projectId),
        actor,
        actionGroup: "COMMENT",
        actionType: "UPDATE",
        target: {
          itemId: String(result._id),
          itemModel: "Comment",
          itemName: "Todo comment",
        },
        metaData: { todoId: String(result.todoId) },
      });
    }
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
    const before = await commentTodoModel.findById(req.params.commentId).lean();
    const result = await todoCommentService.deleteComment(req.params.commentId);
    const actor = actorFromReq(req);
    const todo = before?.todoId
      ? await TodoModel.findById(before.todoId).select("projectId title").lean()
      : null;
    if (actor && todo?.projectId && before?._id) {
      await logActivitySafe({
        projectId: projectIdToString(todo.projectId),
        actor,
        actionGroup: "COMMENT",
        actionType: "DELETE",
        target: {
          itemId: String(before._id),
          itemModel: "Comment",
          itemName: "Todo comment",
        },
        metaData: { todoId: String(before.todoId) },
      });
    }
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
