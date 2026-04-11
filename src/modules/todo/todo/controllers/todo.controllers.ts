import express from "express";
import { authenticate } from "../../../../middlewares/authMiddlewares";
import TodoService from "../services/todo.services";
import todoModel from "../schemas/todo.schema";
import {
  actorFromReq,
  logActivitySafe,
  projectIdToString,
} from "../../../activity/utils/auditActivity.helpers";

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
    const actor = actorFromReq(req);
    if (actor && result?._id) {
      const pid = result.projectId ?? req.params.projectId;
      if (pid) {
        await logActivitySafe({
          projectId: projectIdToString(pid),
          actor,
          actionGroup: "TODO",
          actionType: "CREATE",
          target: {
            itemId: String(result._id),
            itemModel: "Todo",
            itemName: result.name ?? "Todo",
          },
          description: `Created board todo "${result.name ?? ""}"`,
        });
      }
    }
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
    const actor = actorFromReq(req);
    if (actor && result?._id) {
      const assignTouched =
        Object.prototype.hasOwnProperty.call(req.body ?? {}, "assignees");
      await logActivitySafe({
        projectId: projectIdToString(result.projectId),
        actor,
        actionGroup: "TODO",
        actionType: assignTouched ? "UPDATE_ASSIGN" : "UPDATE",
        target: {
          itemId: String(result._id),
          itemModel: "Todo",
          itemName: result.name ?? "Todo",
        },
        description: assignTouched
          ? `Updated assignments for "${result.name ?? "todo"}"`
          : `Updated todo "${result.name ?? ""}"`,
        metaData: { keys: Object.keys(req.body ?? {}) },
      });
    }
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
    const existing = await todoModel.findById(req.params.todoId).lean();
    const result = await teamService.deleteTodo(req.params.todoId, req.userId);
    const actor = actorFromReq(req);
    if (actor && existing?._id) {
      await logActivitySafe({
        projectId: projectIdToString(existing.projectId),
        actor,
        actionGroup: "TODO",
        actionType: "DELETE",
        target: {
          itemId: String(existing._id),
          itemModel: "Todo",
          itemName: (existing as { name?: string }).name ?? "Todo",
        },
        description: `Deleted board todo "${(existing as { name?: string }).name ?? ""}"`,
      });
    }
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
