import { Types } from "mongoose";
import projectMemberSchema from "../../../project/schemas/project-member.schema";
import todoModel from "../schemas/todo.schema";
import AccountModel from "../../../account/schemas/account.schema";
import { ITodo, IAssigness } from "../interfaces/todo.inferfaces";
import { sendEmail } from "../../../../lib/mailer.lib";
import { assignTodoTemplate } from "../../../../templates/templateEmail";
import notificationModel from "../../../notification/schemas/comment.schemas";
import { getIO } from "../../../../lib/socket.lib";
import groupModel from "../../../team/schemas/group.schema";
import groupMemberModel from "../../../team/schemas/group-member.schema";
import { AppError } from "../../../../utils/AppError";

export default class TodoService {
  private async getActorRole(
    projectId: string | Types.ObjectId,
    userId: Types.ObjectId | undefined
  ): Promise<"ADMIN" | "LEADER" | "MEMBER"> {
    if (!userId) throw new AppError("Unauthorized", 401);
    const pm = await projectMemberSchema.findOne({ userId, projectId }).lean();
    if (!pm) throw new AppError("Bạn không có quyền truy cập vào dự án này.", 403);
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
        todoName: todo.name,
        link: "https://your-link.com",
      });
      await sendEmail(
        assignee.label, // to
        `${todo.name} is assigned to you`, // subject
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
      title: `Todo ${todo.name}`,
      content: `You have been assigned: ${todo.name}`,
      isRead: false,
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

  async getAllTodo(projectId: string, userId: Types.ObjectId | undefined) {
    if (!userId) throw new Error("User không hợp lệ.");

    const member = await projectMemberSchema.findOne({ userId, projectId });
    if (!member) throw new Error("Bạn không có quyền truy cập vào dự án này.");

    return await todoModel.find({ projectId });
  }

  async createTodo(
    projectId: string,
    userId: Types.ObjectId | undefined,
    data: ITodo,
  ) {
    if (!userId) throw new Error("User không hợp lệ.");

    const actorRole = await this.getActorRole(projectId, userId);
    if (actorRole === "MEMBER") {
      throw new AppError("Only Admin or Group Leader can create todos.", 403);
    }

    const todo = await todoModel.create({ ...data });

    // Gửi mail cho assignees mới (trong trường hợp tạo mới tất cả đều là mới)
    this.notifyNewAssignees(todo.assignees, [], todo).catch(console.error);
    this.createNotifications(todo.assignees, [], todo).catch(console.error);

    return todo;
  }

  async updateTodo(
    userId: Types.ObjectId | undefined,
    todoId: string,
    updateData: Partial<ITodo>,
  ) {
    if (!userId) throw new Error("User không hợp lệ.");

    const todo = await todoModel.findById(todoId);
    if (!todo) throw new Error("Todo không tồn tại.");

    const actorRole = await this.getActorRole(todo.projectId, userId);

    if (actorRole === "MEMBER") {
      const assignedToMember = (todo.assignees || []).some(
        (a) => a.assigneeId?.toString() === userId.toString()
      );
      if (!assignedToMember) {
        throw new AppError("Members can only update todos assigned to them.", 403);
      }

      const allowedKeys = new Set(["status", "completion", "modifiedOn"]);
      const updateKeys = Object.keys(updateData || {});
      const hasForbidden = updateKeys.some((k) => !allowedKeys.has(k));
      if (hasForbidden) {
        throw new AppError("Members can only update status/completion.", 403);
      }
      if (updateData.status && updateData.status !== "done") {
        throw new AppError("Members can only mark assigned todos as done.", 403);
      }
    }

    const updatedTodo = await todoModel.findByIdAndUpdate(
      todoId,
      { $set: { ...updateData, modifiedOn: new Date() } },
      { new: true, runValidators: true },
    );

    if (!updatedTodo) {
      throw new Error("Todo update failed.");
    }

    // Nếu assignees thay đổi, gửi mail cho assignees mới
    if (updateData.assignees) {
      this.notifyNewAssignees(
        updateData.assignees,
        todo.assignees,
        updatedTodo,
      ).catch(console.error);

      this.createNotifications(
        updateData.assignees,
        todo.assignees,
        updatedTodo,
      ).catch(console.error);
    }

    return updatedTodo;
  }

  async deleteTodo(todoId: string, userId: Types.ObjectId | undefined) {
    if (!userId) throw new Error("User không hợp lệ.");

    const todo = await todoModel.findById(todoId);
    if (!todo) throw new Error("Todo không tồn tại.");

    const actorRole = await this.getActorRole(todo.projectId, userId);
    if (actorRole === "MEMBER") {
      throw new AppError("Only Admin or Group Leader can delete todos.", 403);
    }

    await todoModel.findByIdAndDelete(todoId);
    return { message: "Xóa todo thành công." };
  }
}
