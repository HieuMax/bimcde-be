import express, { Request, Response } from "express";
import TodoService from "../services/todo.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import { authenticate } from "../../../middlewares/authMiddlewares";

const TodoController = express.Router();
const todoService = new TodoService();

/**
 * GET /api/todos
 * Query Params: projectId, status, assignee, priority
 * Desc: Get all todos for a specific project with optional filters.
 */
TodoController.get(
  "/",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, status, assignee, priority } = req.query;

    if (!projectId) {
      throw new AppError("Project ID is required", 400);
    }

    const filters: any = {};
    if (status) filters.status = status;
    if (assignee) filters.assignee = assignee as string;
    if (priority) filters.priority = priority;

    const todos = await todoService.getAllTodos(projectId as string, filters);
    res.json(todos);
  })
);

/**
 * GET /api/todos/:id
 * Desc: Get a todo by ID.
 */
TodoController.get(
  "/:id",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Todo ID is required", 400);
    }

    const todo = await todoService.getTodoById(id);
    res.json(todo);
  })
);

/**
 * POST /api/todos
 * Body: { title, description, status, priority, completion, assignees, type, tags, dueDate, projectId }
 * Desc: Create a new todo.
 */
TodoController.post(
  "/",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      title,
      description,
      status,
      priority,
      completion,
      assignees,
      type,
      tags,
      dueDate,
      projectId,
      items,
      viewState,
    } = req.body;

    if (!title || !projectId) {
      throw new AppError("Title and projectId are required", 400);
    }

    const createdBy = req.userId?.toString();
    if (!createdBy) {
      throw new AppError("User ID is required", 400);
    }

    const newTodo = await todoService.createTodo({
      title,
      description,
      status,
      priority,
      completion,
      assignees: Array.isArray(assignees) ? assignees : assignees ? [assignees] : undefined,
      type,
      tags: Array.isArray(tags) ? tags : tags ? [tags] : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      projectId,
      createdBy,
      items,
      viewState,
    });

    res.status(201).json(newTodo);
  })
);

/**
 * PUT /api/todos/:id
 * Body: { title, description, status, priority, completion, assignees, type, tags, dueDate }
 * Desc: Update todo details.
 */
TodoController.put(
  "/:id",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const {
      title,
      description,
      status,
      priority,
      completion,
      assignees,
      type,
      tags,
      dueDate,
      items,
      viewState,
    } = req.body;

    if (!id) {
      throw new AppError("Todo ID is required", 400);
    }

    const userId = req.userId?.toString();
    if (!userId) {
      throw new AppError("User ID is required", 400);
    }

    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (completion !== undefined) updateData.completion = completion;
    if (assignees !== undefined) {
      updateData.assignees = Array.isArray(assignees) ? assignees : assignees ? [assignees] : [];
    }
    if (type !== undefined) updateData.type = type;
    if (tags !== undefined) {
      updateData.tags = Array.isArray(tags) ? tags : tags ? [tags] : [];
    }
    if (dueDate !== undefined) {
      updateData.dueDate = dueDate ? new Date(dueDate) : null;
    }
    if (items !== undefined) updateData.items = items;
    if (viewState !== undefined) updateData.viewState = viewState;

    if (Object.keys(updateData).length === 0) {
      throw new AppError("Nothing to update", 400);
    }

    const updatedTodo = await todoService.updateTodo(id, updateData, userId);
    res.json(updatedTodo);
  })
);

/**
 * DELETE /api/todos/:id
 * Desc: Delete a todo.
 */
TodoController.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) {
      throw new AppError("Todo ID is required", 400);
    }

    const userId = req.userId?.toString();
    if (!userId) {
      throw new AppError("User ID is required", 400);
    }

    await todoService.deleteTodo(id, userId);
    res.json({ message: "Todo deleted successfully" });
  })
);

/**
 * PATCH /api/todos/:id/status
 * Body: { status }
 * Desc: Update todo status.
 */
TodoController.patch(
  "/:id/status",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body;

    if (!id) {
      throw new AppError("Todo ID is required", 400);
    }

    if (!status) {
      throw new AppError("Status is required", 400);
    }

    const validStatuses = ["New", "In Progress", "Done", "Closed"];
    if (!validStatuses.includes(status)) {
      throw new AppError(`Status must be one of: ${validStatuses.join(", ")}`, 400);
    }

    const updatedTodo = await todoService.updateTodoStatus(id, status);
    res.json(updatedTodo);
  })
);

export { TodoController };
