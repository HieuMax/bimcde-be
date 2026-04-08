import { Types } from "mongoose";
import projectMemberSchema from "../../../project/schemas/project-member.schema";
import {
  ITodo,
  IAssigness,
  IAttachment,
  ITag,
} from "../interfaces/todo.inferfaces";
import { sendEmail } from "../../../../lib/mailer.lib";
import { assignTodoTemplate } from "../../../../templates/templateEmail";
import notificationModel from "../../../notification/schemas/notification.schemas";
import { getIO } from "../../../../lib/socket.lib";
import TodoModel from "../schemas/todo.schema";
import { AppError } from "../../../../utils/AppError";

export default class TodoService {
  // Hàm chung để gửi mail cho những assignees mới
  private async notifyNewAssignees(
    newAssignees: IAssigness[],
    oldAssignees: IAssigness[],
    todo: ITodo,
  ) {
    // Lọc người dùng mới (chỉ những người chưa có trong todo cũ)
    const newlyAdded = newAssignees.filter(
      (newAssignee) =>
        !oldAssignees.some(
          (old) =>
            old.assigneeId?.toString() === newAssignee.assigneeId?.toString(),
        ) && newAssignee.type === "user", // chỉ gửi mail cho assignee type "user"
    );

    if (newlyAdded.length === 0) return;

    for (const assignee of newlyAdded) {
      // Nếu muốn gửi HTML, có thể nhúng HTML trong tham số text
      const html = assignTodoTemplate({
        fullName: assignee.name,
        todoName: todo.title,
        link: `${process.env.CLIENT_URL}/projects/${todo.projectId}/todo`,
      });
      await sendEmail(
        assignee.label, // to
        `${todo.title} is assigned to you`, // subject
        html,
      );
    }
  }

  // Hàm tạo thông báo cho những assigness mới
  private async createNotifications(
    newAssignees: IAssigness[],
    oldAssignees: IAssigness[],
    todo: ITodo,
  ) {
    const newlyAdded = newAssignees.filter(
      (newAssignee) =>
        !oldAssignees.some(
          (old) =>
            old.assigneeId?.toString() === newAssignee.assigneeId?.toString(),
        ) && newAssignee.type === "user", // chỉ gửi mail cho assignee type "user"
    );

    if (newlyAdded.length === 0) return;

    const notifications = newlyAdded.map((assn) => ({
      userId: assn.assigneeId,
      title: `Todo ${todo.title}`,
      content: `You have been assigned: ${todo.title}`,
      isRead: false,
      url: `${process.env.CLIENT_URL}/projects/${todo.projectId}/todo`,
    }));

    const io = getIO();
    notifications.forEach((notification) => {
      io.to(`user_${notification.userId}`).emit(
        "new_notification",
        notification,
      );
    });
    await notificationModel.insertMany(notifications);
  }

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
    status?: "new" | "in_progress" | "done" | "closed";
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
      status: data.status || "new",
      priority: data.priority || "normal",
      completion: data.completion ?? 0,
      type: data.type || "undefined",
      viewState: data.viewState,
      attachments: data.attachments,
    });

    // Gửi mail cho assignees mới (trong trường hợp tạo mới tất cả đều là mới)
    this.notifyNewAssignees(newTodo.assignees, [], newTodo).catch(
      console.error,
    );
    this.createNotifications(newTodo.assignees, [], newTodo).catch(
      console.error,
    );

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

    // Nếu assignees thay đổi, gửi mail cho assignees mới
    if (updatedTodo.assignees) {
      this.notifyNewAssignees(
        updatedTodo.assignees,
        todo.assignees,
        updatedTodo,
      ).catch(console.error);

      this.createNotifications(
        updatedTodo.assignees,
        todo.assignees,
        updatedTodo,
      ).catch(console.error);
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
}
