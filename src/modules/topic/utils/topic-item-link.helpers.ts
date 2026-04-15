import { Types } from "mongoose";
import TopicItemModel from "../schemas/topic-item.schema";
import FileModel from "../../file/schemas/file.schema";
import groupModel from "../../team/schemas/group.schema";
import groupMemberModel from "../../team/schemas/group-member.schema";
import projectMemberSchema from "../../project/schemas/project-member.schema";
import { AppError } from "../../../utils/AppError";
import { countNonTerminalTodosForTopic } from "./topic-todo-collaboration.helpers";

/** Topics the user may pick when linking a 3D todo (workflow “open”). */
export const LINKABLE_TOPIC_ITEM_STATUSES = ["New", "In Progress"] as const;

export async function getActorRole(
  projectId: string | Types.ObjectId,
  userId: Types.ObjectId | undefined,
): Promise<"ADMIN" | "LEADER" | "MEMBER"> {
  if (!userId) throw new AppError("Unauthorized", 401);
  const member = await projectMemberSchema
    .findOne({ userId, projectId })
    .lean();
  if (!member)
    throw new AppError("Bạn không có quyền truy cập vào dự án này.", 403);
  if (String(member.role).toLowerCase() === "admin") return "ADMIN";

  const groups = await groupModel.find({ projectId }).select("_id").lean();
  const groupIds = groups.map((g) => g._id);
  const gm = await groupMemberModel
    .findOne({ userId, groupId: { $in: groupIds }, role: "GROUP_LEADER" })
    .lean();
  return gm ? "LEADER" : "MEMBER";
}

export async function userGroupIdsInProject(
  userId: Types.ObjectId,
  projectId: string | Types.ObjectId,
): Promise<Types.ObjectId[]> {
  const groups = await groupModel.find({ projectId }).select("_id").lean();
  const groupIds = groups.map((g) => g._id);
  const gms = await groupMemberModel
    .find({ userId, groupId: { $in: groupIds } })
    .select("groupId")
    .lean();
  return gms.map((g) => g.groupId as Types.ObjectId);
}

export async function userCanSeeTopicItemForLink(
  userId: Types.ObjectId,
  projectId: string,
  topic: {
    references?: Types.ObjectId[] | null;
  },
  role: "ADMIN" | "LEADER" | "MEMBER",
): Promise<boolean> {
  if (role === "ADMIN") return true;
  const refs = topic.references?.length ? topic.references : [];
  if (refs.length === 0) return true;

  const userGroups = await userGroupIdsInProject(userId, projectId);
  if (userGroups.length === 0) return false;

  const files = await FileModel.find({
    _id: { $in: refs },
    projectId: new Types.ObjectId(projectId),
  })
    .select("groupId")
    .lean();

  for (const f of files) {
    const gid = f.groupId;
    if (!gid) return true;
    if (userGroups.some((ug) => ug.toString() === gid.toString())) return true;
  }
  return false;
}

export async function assertTopicItemLinkableForUser(
  projectId: string,
  topicId: string | null | undefined,
  userId: Types.ObjectId | undefined,
): Promise<void> {
  if (!topicId || !Types.ObjectId.isValid(topicId)) return;
  const topic = await TopicItemModel.findById(topicId).lean();
  if (!topic) throw new AppError("Topic not found", 404);
  if (topic.projectId.toString() !== projectId) {
    throw new AppError("Topic does not belong to this project", 400);
  }
  const status = String(topic.status || "");
  if (!(LINKABLE_TOPIC_ITEM_STATUSES as readonly string[]).includes(status)) {
    throw new AppError(
      "This topic cannot be linked (only New / In Progress topics are linkable).",
      400,
    );
  }
  if (!userId) throw new AppError("Unauthorized", 401);
  const role = await getActorRole(projectId, userId);
  const ok = await userCanSeeTopicItemForLink(
    userId,
    projectId,
    topic as { references?: Types.ObjectId[] | null },
    role,
  );
  if (!ok) throw new AppError("You cannot link to this topic.", 403);
}

export async function findGroupLeaderUserIdsForTopicItem(
  projectId: string,
  topic: { references?: Types.ObjectId[] | null },
): Promise<Types.ObjectId[]> {
  const refs = topic.references?.length ? topic.references : [];
  const pid = new Types.ObjectId(projectId);

  if (refs.length === 0) {
    const groups = await groupModel.find({ projectId: pid }).select("_id").lean();
    const groupIds = groups.map((g) => g._id);
    const leaders = await groupMemberModel
      .find({ groupId: { $in: groupIds }, role: "GROUP_LEADER" })
      .select("userId")
      .lean();
    const ids = leaders.map((l) => l.userId as Types.ObjectId);
    return [...new Map(ids.map((id) => [id.toString(), id])).values()];
  }

  const files = await FileModel.find({
    _id: { $in: refs },
    projectId: pid,
  })
    .select("groupId")
    .lean();

  const groupIds = new Set<string>();
  for (const f of files) {
    if (f.groupId) groupIds.add((f.groupId as Types.ObjectId).toString());
  }

  if (groupIds.size === 0) {
    const groups = await groupModel.find({ projectId: pid }).select("_id").lean();
    for (const g of groups) groupIds.add(g._id.toString());
  }

  const gids = [...groupIds].map((id) => new Types.ObjectId(id));
  const leaders = await groupMemberModel
    .find({ groupId: { $in: gids }, role: "GROUP_LEADER" })
    .select("userId")
    .lean();
  const ids = leaders.map((l) => l.userId as Types.ObjectId);
  return [...new Map(ids.map((id) => [id.toString(), id])).values()];
}

export async function countOpenTodosLinkedToTopicItem(
  topicItemId: string,
): Promise<number> {
  return countNonTerminalTodosForTopic(topicItemId);
}
