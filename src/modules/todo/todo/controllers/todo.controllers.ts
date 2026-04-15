import express, { Request, Response } from "express";
import { authenticate } from "../../../../middlewares/authMiddlewares";
import TodoService from "../services/todo.services";
import { asyncHandler } from "../../../../utils/asyncHandler";
import { AppError } from "../../../../utils/AppError";
import todoModel from "../schemas/todo.schema";
import {
  actorFromReq,
  logActivitySafe,
  projectIdToString,
} from "../../../activity/utils/auditActivity.helpers";

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
  }),
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
  }),
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
      topicItemId,
      items,
      viewState,
      attachments,
    } = req.body;

    if (!title || !projectId) {
      throw new AppError("Title and projectId are required", 400);
    }

    const createdBy = req.userId?.toString();
    if (!createdBy) {
      throw new AppError("User ID is required", 400);
    }

    const newTodo = await todoService.createTodo(projectId, req.userId, {
      title,
      description,
      status,
      priority,
      completion,
      assignees: Array.isArray(assignees)
        ? assignees
        : assignees
          ? [assignees]
          : undefined,
      type,
      tags: Array.isArray(tags) ? tags : tags ? [tags] : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      projectId,
      createdBy,
      topicItemId:
        topicItemId !== undefined && topicItemId !== null && topicItemId !== ""
          ? String(topicItemId)
          : undefined,
      items,
      viewState,
      attachments,
    });

    const actor = actorFromReq(req);
    if (actor && newTodo?._id) {
      const pid = newTodo.projectId ?? req.params.projectId;
      if (pid) {
        await logActivitySafe({
          projectId: projectIdToString(pid),
          actor,
          actionGroup: "TODO",
          actionType: "CREATE",
          target: {
            itemId: String(newTodo._id),
            itemModel: "Todo",
            itemName: newTodo.title ?? "Todo",
          },
          description: `Created board todo "${newTodo.title ?? ""}"`,
        });
      }
    }

    res.status(201).json(newTodo);
  }),
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
      attachments,
    } = req.body;

    if (!id) {
      throw new AppError("Todo ID is required", 400);
    }

    const userId = req.userId;
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
      updateData.assignees = Array.isArray(assignees)
        ? assignees
        : assignees
          ? [assignees]
          : [];
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
    if (attachments !== undefined) updateData.attachments = attachments;

    if (Object.keys(updateData).length === 0) {
      throw new AppError("Nothing to update", 400);
    }

    const updatedTodo = await todoService.updateTodo(id, updateData, userId);

    const actor = actorFromReq(req);
    if (actor && updatedTodo?._id) {
      const assignTouched = Object.prototype.hasOwnProperty.call(
        req.body ?? {},
        "assignees",
      );
      await logActivitySafe({
        projectId: projectIdToString(updatedTodo.projectId),
        actor,
        actionGroup: "TODO",
        actionType: assignTouched ? "UPDATE_ASSIGN" : "UPDATE",
        target: {
          itemId: String(updatedTodo._id),
          itemModel: "Todo",
          itemName: updatedTodo.title ?? "Todo",
        },
        description: assignTouched
          ? `Updated assignments for "${updatedTodo.title ?? "todo"}"`
          : `Updated todo "${updatedTodo.title ?? ""}"`,
        metaData: { keys: Object.keys(req.body ?? {}) },
      });
    }
    res.json(updatedTodo);
  }),
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

    const userId = req.userId;
    if (!userId) {
      throw new AppError("User ID is required", 400);
    }

    const existing = await todoModel.findById(req.params.todoId).lean();
    await todoService.deleteTodo(id, userId);
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
          itemName: (existing as { title?: string }).title ?? "Todo",
        },
        description: `Deleted board todo "${(existing as { title?: string }).title ?? ""}"`,
      });
    }

    res.json({ message: "Todo deleted successfully" });
  }),
);

export { TodoController };
