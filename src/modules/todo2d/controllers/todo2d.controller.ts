import express, { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import { authenticate } from "../../../middlewares/authMiddlewares";
import Todo2DService from "../services/todo2d.service";
import AccountModel from "../../account/schemas/account.schema";
import {
  actorFromReq,
  logActivitySafe,
  projectIdToString,
} from "../../activity/utils/auditActivity.helpers";
import Todo2DModel from "../schemas/todo2d.schema";

const Todo2DController = express.Router();
const todo2DService = new Todo2DService();

// POST /api/todos
Todo2DController.post(
  "/",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).userId;

    if (!userId) {
      throw new AppError("Unauthorized: User ID not found", 401);
    }

    const user = await AccountModel.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const createdBy = user.fullName || user.email || "Unknown";
    const updatedBy = createdBy; // ✅ IMPORTANT

    const newTodo = await todo2DService.createTodo({
      ...req.body,
      userId,
      createdBy,
      updatedBy,
    });

    const actor = actorFromReq(req);
    if (actor && newTodo?._id && newTodo.projectId) {
      await logActivitySafe({
        projectId: projectIdToString(newTodo.projectId),
        actor,
        actionGroup: "TODO",
        actionType: "CREATE",
        target: {
          itemId: String(newTodo._id),
          itemModel: "Todo",
          itemName: String(newTodo.title ?? "Todo"),
        },
        description: `Created 2D todo "${String(newTodo.title ?? "")}"`,
      });
    }

    res.status(201).json(newTodo);
  })
);


// GET /api/todos/file/:fileId
Todo2DController.get(
  "/file/:fileId",
  asyncHandler(async (req: Request, res: Response) => {
    const list = await todo2DService.getTodosByFile(req.params.fileId);
    res.status(200).json(list);
  })
);

// DELETE /api/todos/:id
Todo2DController.delete(
  "/:id",
  authenticate, // 👈 Bắt buộc xác thực
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    
    // 👈 Lấy userId từ middleware
    const userId = (req as any).userId;
    
    if (!userId) {
      throw new AppError("Unauthorized: User ID not found", 401);
    }

    console.log("🗑️ [DELETE TODO] Todo ID:", id);
    console.log("🗑️ [DELETE TODO] User ID:", userId);

    const existing = await Todo2DModel.findById(id).lean();
    // Gọi service backend để set isDeleted = true
    await todo2DService.deleteTodo(id);

    const actor = actorFromReq(req);
    if (actor && existing?._id) {
      const t = existing as { _id: unknown; projectId?: unknown; title?: string };
      await logActivitySafe({
        projectId: projectIdToString(t.projectId),
        actor,
        actionGroup: "TODO",
        actionType: "DELETE",
        target: {
          itemId: String(t._id),
          itemModel: "Todo",
          itemName: String(t.title ?? "Todo"),
        },
        description: "Deleted 2D todo",
      });
    }

    res.status(200).json({ success: true, message: "Todo deleted" });
  })
);

Todo2DController.put(
  "/:id",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = (req as any).userId;

    if (!userId) {
      throw new AppError("Unauthorized: User ID not found", 401);
    }

    // Tìm user để lấy tên người cập nhật
    const user = await AccountModel.findById(userId);
    if (!user) {
      throw new AppError("User not found", 404);
    }

    const updatedBy = user.fullName || user.email || "Unknown";

    // Gộp dữ liệu update từ body và thêm updatedBy
    const updateData = {
      ...req.body,
      updatedBy,
    };

    // Gọi hàm update trong service của Backend
    const updatedTodo = await todo2DService.updateTodo(id, updateData);

    if (!updatedTodo) {
      throw new AppError("Todo not found", 404);
    }

    const actor = actorFromReq(req);
    if (actor && updatedTodo._id && updatedTodo.projectId) {
      await logActivitySafe({
        projectId: projectIdToString(updatedTodo.projectId),
        actor,
        actionGroup: "TODO",
        actionType: "UPDATE",
        target: {
          itemId: String(updatedTodo._id),
          itemModel: "Todo",
          itemName: String(updatedTodo.title ?? "Todo"),
        },
        description: `Updated 2D todo "${String(updatedTodo.title ?? "")}"`,
      });
    }

    res.status(200).json(updatedTodo);
  })
);

// GET /api/todos/project/:projectId
Todo2DController.get(
  "/project/:projectId",
  asyncHandler(async (req: Request, res: Response) => {
    const list = await todo2DService.getTodosByProject(req.params.projectId);
    res.status(200).json(list);
  })
);

export default Todo2DController;