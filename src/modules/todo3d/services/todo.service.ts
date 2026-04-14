import TodoModel from "../schemas/todo.schema";
import {
  IAssigness,
  IAttachment,
  ITag,
  ITodo,
} from "../interfaces/todo.interface";
import { AppError } from "../../../utils/AppError";
import { Types } from "mongoose";
import {
  assertTopicItemLinkableForUser,
  countOpenTodosLinkedToTopicItem,
  findGroupLeaderUserIdsForTopicItem,
  getActorRole,
} from "../../topic/utils/topic-item-link.helpers";
import TopicItemModel from "../../topic/schemas/topic-item.schema";
import notificationModel from "../../notification/schemas/notification.schemas";
import { getIO } from "../../../lib/socket.lib";

export default class TodoService {
  private async assertCanChangeTopicLinkOrThrow(
    todo: ITodo,
    userIdStr: string,
  ): Promise<void> {
    const uid = new Types.ObjectId(userIdStr);
    const role = await getActorRole(todo.projectId, uid);
    if (role === "ADMIN" || role === "LEADER") return;
    if (todo.createdBy.toString() === userIdStr) return;
    throw new AppError(
      "Only a group leader, project admin, or the todo creator can link or unlink this todo from a topic.",
      403,
    );
  }

  private async notifyLeadersTopicTodosAllDone(
    projectId: string,
    topicId: Types.ObjectId,
    _actorUserId: string,
  ): Promise<void> {
    const topic = await TopicItemModel.findById(topicId).lean();
    if (!topic) return;
    const leaders = await findGroupLeaderUserIdsForTopicItem(projectId, topic);
    if (leaders.length === 0) return;

    const topicKey =
      (topic as { code?: string }).code ||
      (topic as { topicKey?: string }).topicKey ||
      topicId.toString();
    const baseUrl = process.env.CLIENT_URL || "";
    const io = getIO();

    for (const uid of leaders) {
      const doc = await notificationModel.create({
        userId: uid,
        title: `Topic ${topicKey}: all todos completed`,
        content:
          "All 3D todos linked to this topic are done. You can mark the topic as Done if the issue is resolved.",
        isRead: false,
        url: `${baseUrl}/projects/${projectId}/viewer3d`,
      });
      const plain = doc.toObject();
      io.to(`user_${uid}`).emit("new_notification", plain);
      io.to(`user_${uid}`).emit("topic_resolve_suggestion", {
        topicId: topicId.toString(),
        topicKey,
        projectId,
        notificationId: String(doc._id),
      });
    }
  }

  private async afterTodoBecameTerminal(
    before: ITodo | null,
    after: ITodo | null,
    actorUserId: string,
  ): Promise<void> {
    if (!before || !after?.topicId) return;
    const wasTerm =
      before.status === "Done" || before.status === "Closed";
    const isTerm = after.status === "Done" || after.status === "Closed";
    if (wasTerm || !isTerm) return;
    const n = await countOpenTodosLinkedToTopicItem(
      after.topicId.toString(),
    );
    if (n > 0) return;
    await this.notifyLeadersTopicTodosAllDone(
      after.projectId.toString(),
      after.topicId as Types.ObjectId,
      actorUserId,
    );
  }

  // --- GET ALL TODOS BY PROJECT ---
  async getAllTodos(
    projectId: string,
    filters?: {
      status?: string;
      assignee?: string;
      priority?: string;
      topicId?: string;
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

    if (filters?.topicId && Types.ObjectId.isValid(filters.topicId)) {
      query.topicId = new Types.ObjectId(filters.topicId);
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
    topicId?: string | null;
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

    let topicObjectId: Types.ObjectId | null = null;
    if (data.topicId) {
      await assertTopicItemLinkableForUser(
        data.projectId,
        String(data.topicId),
        new Types.ObjectId(data.createdBy),
      );
      topicObjectId = new Types.ObjectId(String(data.topicId));
    }

    const newTodo = await TodoModel.create({
      title: data.title,
      description: data.description,
      projectId: new Types.ObjectId(data.projectId),
      createdBy: new Types.ObjectId(data.createdBy),
      topicId: topicObjectId,
      status: data.status || "New",
      priority: data.priority || "normal",
      completion: data.completion ?? 0,
      type: data.type || "undefined",
      assignees: data.assignees,
      tags: data.tags,
      dueDate: data.dueDate,
      items: data.items,
      viewState: data.viewState,
      attachments: data.attachments,
    });

    return await this.getTodoById(newTodo._id.toString());
  }

  // --- UPDATE TODO ---
  async updateTodo(
    id: string,
    data: Partial<ITodo> & { topicId?: string | null },
    userId: string,
  ): Promise<ITodo> {
    const todo = await TodoModel.findById(id);

    if (!todo) {
      throw new AppError("Todo not found", 404);
    }

    const patch: Record<string, unknown> = { ...data };

    if (Object.prototype.hasOwnProperty.call(data, "topicId")) {
      await this.assertCanChangeTopicLinkOrThrow(todo, userId);
      const raw = data.topicId;
      if (raw === null || raw === "") {
        patch.topicId = null;
      } else {
        await assertTopicItemLinkableForUser(
          todo.projectId.toString(),
          String(raw),
          new Types.ObjectId(userId),
        );
        patch.topicId = new Types.ObjectId(String(raw));
      }
    }

    const before = await TodoModel.findById(id).lean();

    const updatedTodo = await TodoModel.findByIdAndUpdate(id, patch, {
      new: true,
      runValidators: true,
    })
      .populate("createdBy", "fullName email")
      .exec();

    if (!updatedTodo) {
      throw new AppError("Todo not found", 404);
    }

    await this.afterTodoBecameTerminal(
      before as ITodo | null,
      updatedTodo,
      userId,
    );

    return updatedTodo;
  }

  // --- DELETE TODO ---
  async deleteTodo(id: string, userId: string): Promise<boolean> {
    const todo = await TodoModel.findById(id);

    if (!todo) {
      throw new AppError("Todo not found", 404);
    }

    await TodoModel.findByIdAndDelete(id);

    return true;
  }

  // --- UPDATE TODO STATUS ---
  async updateTodoStatus(
    id: string,
    status: "New" | "In Progress" | "Done" | "Closed",
    userId?: string,
  ): Promise<ITodo> {
    const before = await TodoModel.findById(id).lean();

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

    if (userId) {
      await this.afterTodoBecameTerminal(
        before as ITodo | null,
        todo,
        userId,
      );
    }

    return todo;
  }
}
