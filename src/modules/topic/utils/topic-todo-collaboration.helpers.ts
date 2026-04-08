import { Types } from "mongoose";
import { AppError } from "../../../utils/AppError";
import Todo2DModel from "../../todo2d/schemas/todo2d.schema";
import TopicItemModel from "../schemas/topic-item.schema";

export async function countNonTerminalTodosForTopic(
  topicId: string,
): Promise<number> {
  if (!Types.ObjectId.isValid(topicId)) return 0;
  return Todo2DModel.countDocuments({
    topicId: new Types.ObjectId(topicId),
    isDeleted: { $ne: true },
    status: { $nin: ["Done", "Closed"] },
  });
}

/** Topic statuses that require all child todos to be Done/Closed first */
export const TOPIC_RESOLUTION_STATUSES = ["Done", "Resolved", "Closed"] as const;

export function isTopicResolutionStatus(s: string): boolean {
  return (TOPIC_RESOLUTION_STATUSES as readonly string[]).includes(s);
}

/**
 * Shared→Published: block if any linked topic is still "active" (not Done/Resolved/Closed),
 * or any file-level Todo2D is not Done/Closed.
 */
export async function assertFileSafeToPublish(
  projectId: string,
  fileId: string,
): Promise<void> {
  const pid = new Types.ObjectId(projectId);
  const fid = new Types.ObjectId(fileId);

  const topicOr = [
    { fileId: fid },
    { "attachments.fileId": fileId },
  ];

  const unresolvedTopics = await TopicItemModel.countDocuments({
    projectId: pid,
    $or: topicOr,
    status: {
      $nin: ["Done", "Resolved", "Closed"],
    },
  });

  const openTodos = await Todo2DModel.countDocuments({
    projectId,
    fileId,
    isDeleted: { $ne: true },
    status: { $nin: ["Done", "Closed"] },
  });

  if (unresolvedTopics > 0 || openTodos > 0) {
    throw new AppError(
      "Cannot publish. This file has unresolved issues in the Topics module.",
      409,
    );
  }
}
