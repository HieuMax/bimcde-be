import express, { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import { authenticate } from "../../../middlewares/authMiddlewares";
import Todo2DService from "../services/todo2d.service";
import AccountModel from "../../account/schemas/account.schema";

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

    // Gọi service backend để set isDeleted = true
    await todo2DService.deleteTodo(id);
    
    res.status(200).json({ success: true, message: "Todo deleted" });
  })
);

export default Todo2DController;