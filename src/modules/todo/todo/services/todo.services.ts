import { Types } from "mongoose";
import projectMemberSchema from "../../../project/schemas/project-member.schema";
import {
  ITodo,
  IAssigness,
  IAttachment,
  ITag,
  IPriority,
  IType,
} from "../interfaces/todo.inferfaces";
import { sendEmail } from "../../../../lib/mailer.lib";
import { assignTodoTemplate } from "../../../../templates/templateEmail";
import notificationModel from "../../../notification/schemas/notification.schemas";
import { getIO } from "../../../../lib/socket.lib";
import TodoModel from "../schemas/todo.schema";
import groupModel from "../../../team/schemas/group.schema";
import groupMemberModel from "../../../team/schemas/group-member.schema";
import { AppError } from "../../../../utils/AppError";
import { Type } from "@aws-sdk/client-s3";

export default class TodoService {
  private async getActorRole(
    projectId: string | Types.ObjectId,
    userId: Types.ObjectId | undefined,
  ): Promise<"ADMIN" | "LEADER" | "MEMBER"> {
    if (!userId) throw new AppError("Unauthorized", 401);
    const pm = await projectMemberSchema.findOne({ userId, projectId }).lean();
    if (!pm)
      throw new AppError("Bạn không có quyền truy cập vào dự án này.", 403);
    if (String(pm.role).toLowerCase() === "admin") return "ADMIN";

    const groups = await groupModel.find({ projectId }).select("_id").lean();
    const groupIds = groups.map((g) => g._id);
    const gm = await groupMemberModel
      .findOne({ userId, groupId: { $in: groupIds }, role: "GROUP_LEADER" })
      .lean();
    return gm ? "LEADER" : "MEMBER";
  }

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
  async createTodo(
    projectId: string,
    userId: Types.ObjectId | undefined,
    data: {
      title: string;
      description?: string;
      status?: string;
      priority?: IPriority;
      completion?: number;
      assignees?: IAssigness[];
      type?: IType;
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
      topicItemId?: string;
    },
  ): Promise<ITodo> {
    if (!data.title || !data.projectId || !data.createdBy) {
      throw new AppError("Title, projectId, and createdBy are required", 400);
    }

    const topicItemId =
      data.topicItemId && Types.ObjectId.isValid(data.topicItemId)
        ? new Types.ObjectId(data.topicItemId)
        : undefined;

    const { topicItemId: _dropTopicItemId, ...rest } = data as typeof data & {
      topicItemId?: string;
    };

    const newTodo = await TodoModel.create({
      ...rest,
      projectId: new Types.ObjectId(data.projectId),
      createdBy: new Types.ObjectId(data.createdBy),
      topicItemId: topicItemId ?? null,
      status: data.status || "new",
      priority: data.priority || "normal",
      completion: data.completion ?? 0,
      type: data.type || "undefined",
      viewState: data.viewState,
      attachments: data.attachments,
    });

    // Allow project members to create todos. Higher roles still have full privileges.
    // Previously members were blocked from creating todos. Now members can create todos,
    // but other operations (update/delete) still enforce role checks where appropriate.
    // (Actor role may still be used for notifications or downstream logic.)
    // We still fetch the actor role to ensure the user belongs to the project.
    await this.getActorRole(projectId, userId);

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
    userId: Types.ObjectId | undefined,
  ): Promise<ITodo> {
    const todo = await TodoModel.findById(id);

    if (!todo) {
      throw new AppError("Todo not found", 404);
    }

    // Optional: Check if user has permission to update (e.g., creator or assignee)
    // For now, we'll allow updates by any authenticated user

    const actorRole = await this.getActorRole(todo.projectId, userId);

    if (actorRole === "MEMBER") {
      if (!userId) throw new AppError("Unauthorized", 401);
      const assignedToMember = (todo.assignees || []).some(
        (a) => a.assigneeId?.toString() === userId.toString(),
      );
      if (!assignedToMember) {
        throw new AppError(
          "Members can only update todos assigned to them.",
          403,
        );
      }

      const allowedKeys = new Set(["status", "completion", "modifiedOn"]);
      const updateKeys = Object.keys(data || {});
      const hasForbidden = updateKeys.some((k) => !allowedKeys.has(k));
      if (hasForbidden) {
        throw new AppError("Members can only update status/completion.", 403);
      }
      if (data.status && data.status !== "done") {
        throw new AppError(
          "Members can only mark assigned todos as done.",
          403,
        );
      }
    }

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
  async deleteTodo(id: string, userId: Types.ObjectId | undefined): Promise<boolean> {
    const todo = await TodoModel.findById(id);

    if (!todo) {
      throw new AppError("Todo not found", 404);
    }

    const actorRole = await this.getActorRole(todo.projectId, userId);
    if (actorRole === "MEMBER") {
      if (!userId) throw new AppError("Unauthorized", 401);
      // Allow a member to delete a todo only if they are the creator of that todo.
      if (todo.createdBy?.toString() !== userId.toString()) {
        throw new AppError("Bạn không có quyền xóa todo này.", 403);
      }
      // otherwise allow deletion
    }

    await TodoModel.findByIdAndDelete(id);

    return true;
  }
}
