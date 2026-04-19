import { Types } from "mongoose";
import { AppError } from "../../../utils/AppError";
import TopicItemModel from "../../topic/schemas/topic-item.schema";
import TodoModel from "../schemas/todo2d.schema";
import { ITodo } from "../interfaces/todo2d.interface";

async function assertTodoTopicMatchesFile(
  topicId: unknown,
  fileId: string,
): Promise<void> {
  if (topicId == null || topicId === "") return;
  const tid = String(topicId);
  if (!Types.ObjectId.isValid(tid)) {
    throw new AppError("Invalid topicId", 400);
  }
  const topic = await TopicItemModel.findById(tid).lean();
  if (!topic) {
    throw new AppError("Topic not found", 404);
  }
  const main = topic.fileId?.toString();
  if (main && main !== fileId) {
    throw new AppError("Todo file must match the topic's linked file.", 400);
  }
  if (!main) {
    const ok = (topic.attachments ?? []).some(
      (a: { fileId?: string }) => a?.fileId && String(a.fileId) === fileId,
    );
    if (!ok) {
      throw new AppError(
        "Todo file must match a file linked to this topic.",
        400,
      );
    }
  }
}

export default class Todo2DService {
  // Tạo Todo mới
  async createTodo(data: Partial<ITodo>) {
    if (data.fileId && data.topicId) {
      await assertTodoTopicMatchesFile(data.topicId, String(data.fileId));
    }
    const payload = { ...data } as Partial<ITodo>;
    if (payload.projectId) {
      const pid = String(payload.projectId);
      const withCode = await TodoModel.find({
        projectId: pid,
        code: { $regex: /^TO-\d+$/ },
      })
        .select("code")
        .lean();
      let maxN = 0;
      for (const doc of withCode) {
        const c = (doc as { code?: string }).code;
        const m = c ? /^TO-(\d+)$/.exec(c) : null;
        if (m) maxN = Math.max(maxN, parseInt(m[1], 10));
      }
      payload.code = `TO-${String(maxN + 1).padStart(4, "0")}`;
    }
    return await TodoModel.create(payload);
  }

  // Lấy danh sách Todo theo File
  async getTodosByFile(fileId: string) {
    return await TodoModel.find({ fileId, isDeleted: false })
      .sort({ createdAt: -1 });
  }

  // Lấy danh sách Todo theo Project
  async getTodosByProject(projectId: string) {
    return await TodoModel.find({ projectId, isDeleted: false })
      .sort({ createdAt: -1 })
      .populate("fileId", "name"); 
  }

  // Cập nhật Todo
  async updateTodo(id: string, data: Partial<ITodo>) {
    const prev = await TodoModel.findById(id);
    if (!prev) return null;
    const nextFile = data.fileId != null ? String(data.fileId) : prev.fileId;
    const nextTopic =
      data.topicId !== undefined ? data.topicId : prev.topicId ?? null;
    if (nextTopic) {
      await assertTodoTopicMatchesFile(nextTopic, nextFile);
    }
    return await TodoModel.findByIdAndUpdate(id, data, { new: true });
  }

  // Xóa
  async deleteTodo(id: string) {
    return await TodoModel.findByIdAndDelete(id);
  }
}