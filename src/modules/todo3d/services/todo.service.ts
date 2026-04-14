import TodoModel from "../schemas/todo.schema";
import { IAssigness, IAttachment, ITag, ITodo } from "../interfaces/todo.interface";
import { AppError } from "../../../utils/AppError";
import { Types } from "mongoose";

export default class TodoService {
  // --- GET ALL TODOS BY PROJECT ---
  async getAllTodos(
    projectId: string,
    filters?: {
      status?: string;
      assignee?: string;
      priority?: string;
    },
  ): Promise<ITodo[]> {
    const query: any = { projectId: new Types.ObjectId(projectId) };

    if (filters?.status) {
      query.status = filters.status;
    }

    if (filters?.assignee) {
      query.assignees = { $in: [filters.assignee] };
    }

    if (filters?.priority) {
      query.priority = filters.priority;
    }

    return await TodoModel.find(query)
      .sort({ createdAt: -1 })
      .populate("createdBy", "fullName email")
      .exec();
  }

  // --- GET TODO BY ID ---
  async getTodoById(id: string): Promise<ITodo> {
    const todo = await TodoModel.findById(id)
      .populate("createdBy", "fullName email")
      .exec();

    if (!todo) {
      throw new AppError("Todo not found", 404);
    }

    return todo;
  }

  // --- CREATE TODO ---
  async createTodo(data: {
    title: string;
    description?: string;
    status?: "New" | "In Progress" | "Done" | "Closed";
    priority?: "high" | "normal" | "low";
    completion?: number;
    assignees?: IAssigness[];
    type?:
      | "undefined"
      | "comment"
      | "issue"
      | "request"
      | "fault"
      | "inquiry"
      | "solution"
      | "remark"
      | "clash";
    tags?: ITag[];
    dueDate?: Date;
    projectId: string;
    createdBy: string;
    items?: {
      fileUrl: string;
      modelId: string;
      expressId: string[];
    }[];
    viewState?: any;
    attachments?: IAttachment[];
  }): Promise<ITodo> {
    if (!data.title || !data.projectId || !data.createdBy) {
      throw new AppError("Title, projectId, and createdBy are required", 400);
    }

    const newTodo = await TodoModel.create({
      ...data,
      projectId: new Types.ObjectId(data.projectId),
      createdBy: new Types.ObjectId(data.createdBy),
      status: data.status || "New",
      priority: data.priority || "normal",
      completion: data.completion ?? 0,
      type: data.type || "undefined",
      viewState: data.viewState,
      attachments: data.attachments,
    });

    return await this.getTodoById(newTodo._id.toString());
  }

  // --- UPDATE TODO ---
  async updateTodo(
    id: string,
    data: Partial<ITodo>,
    userId: string,
  ): Promise<ITodo> {
    const todo = await TodoModel.findById(id);

    if (!todo) {
      throw new AppError("Todo not found", 404);
    }

    // Optional: Check if user has permission to update (e.g., creator or assignee)
    // For now, we'll allow updates by any authenticated user

    const updatedTodo = await TodoModel.findByIdAndUpdate(
      id,
      { ...data },
      { new: true, runValidators: true },
    )
      .populate("createdBy", "fullName email")
      .exec();

    if (!updatedTodo) {
      throw new AppError("Todo not found", 404);
    }
    

    return updatedTodo;
  }

  // --- DELETE TODO ---
  async deleteTodo(id: string, userId: string): Promise<boolean> {
    const todo = await TodoModel.findById(id);

    if (!todo) {
      throw new AppError("Todo not found", 404);
    }

    // Optional: Check if user has permission to delete (e.g., creator or admin)
    // For now, we'll allow deletion by any authenticated user

    await TodoModel.findByIdAndDelete(id);

    return true;
  }

  // --- UPDATE TODO STATUS ---
  async updateTodoStatus(
    id: string,
    status: "New" | "In Progress" | "Done" | "Closed",
  ): Promise<ITodo> {
    const todo = await TodoModel.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true },
    )
      .populate("createdBy", "fullName email")
      .exec();

    if (!todo) {
      throw new AppError("Todo not found", 404);
    }

    return todo;
  }
}
