import express, { Request, Response } from "express";
import AttachtmentTodoService from "../services/attachtment.service";
import { asyncHandler } from "../../../../utils/asyncHandler";
import { AppError } from "../../../../utils/AppError";
import { authenticate } from "../../../../middlewares/authMiddlewares";

const attachtmentTodoController = express.Router();
const attacthmentTodoService = new AttachtmentTodoService();

/**
 * GET /api/todos
 * Query Params: projectId, status, assignee, priority
 * Desc: Get all todos for a specific project with optional filters.
 */
attachtmentTodoController.get(
  "/:id",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const todoId = req.params.id;

    if (!todoId) {
      throw new AppError("Todo ID is required", 400);
    }

    const attachment = await attacthmentTodoService.getAllAttachtment(
      todoId as string,
    );
    res.json(attachment);
  }),
);

/**
 * POST /api/todos
 * Body: { title, description, status, priority, completion, assignees, type, tags, dueDate, projectId }
 * Desc: Create a new todo.
 */
attachtmentTodoController.post(
  "/add",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const data = req.body;

    if (!Array.isArray(data) || data.length === 0) {
      throw new AppError("Attachments are required", 400);
    }

    const createdBy = req.userId?.toString();
    if (!createdBy) {
      throw new AppError("User ID is required", 400);
    }

    const newAttachment = await attacthmentTodoService.AddAttachment(data);

    res.status(201).json(newAttachment);
  }),
);

/**
 * DELETE /api/todos/:id
 * Desc: Delete a todo.
 */
attachtmentTodoController.delete(
  "/delete/:id",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Attachment ID is required", 400);
    }

    const userId = req.userId?.toString();
    if (!userId) {
      throw new AppError("User ID is required", 400);
    }

    await attacthmentTodoService.deleteAttachment(id, userId);
    res.json({ message: "Attachment deleted successfully" });
  }),
);

export { attachtmentTodoController };
