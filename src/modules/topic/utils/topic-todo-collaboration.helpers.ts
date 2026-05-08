import { Types } from "mongoose";
import { AppError } from "../../../utils/AppError";
import Todo2DModel from "../../todo2d/schemas/todo2d.schema";
import Todo3DModel from "../../todo3d/schemas/todo.schema";
import TodoModel from "../../todo/todo/schemas/todo.schema";
import TopicItemModel from "../schemas/topic-item.schema";
import FileModel from "../../file/schemas/file.schema";

export async function countNonTerminalTodosForTopic(
  topicId: string,
): Promise<number> {
  if (!Types.ObjectId.isValid(topicId)) return 0;
  const tid = new Types.ObjectId(topicId);
  const [n2d, n3d] = await Promise.all([
    Todo2DModel.countDocuments({
      topicId: tid,
      isDeleted: { $ne: true },
      status: { $nin: ["Done", "Closed"] },
    }),
    Todo3DModel.countDocuments({
      topicId: tid,
      status: { $nin: ["Done", "Closed"] },
    }),
  ]);
  return n2d + n3d;
}

/** Topic statuses that require all child todos to be Done/Closed first */
export const TOPIC_RESOLUTION_STATUSES = ["Done", "Resolved", "Closed"] as const;

export function isTopicResolutionStatus(s: string): boolean {
  return (TOPIC_RESOLUTION_STATUSES as readonly string[]).includes(s);
}

/**
 * Count all open todos related to a file in Shared→Published context.
 * Includes:
 * - file-level Todo2D (linked by fileId)
 * - Todo3D linked to topics of this file
 * - dashboard Todo linked to topicItemId of this file
 */
export async function countOpenTodosLinkedToFile(
  projectId: string,
  fileId: string,
): Promise<number> {
  const pid = new Types.ObjectId(projectId);
  const fid = new Types.ObjectId(fileId);

  const topicOr = [
    { fileId: fid },
    { "attachments.fileId": fileId },
    // Legacy/alternate relation: topic references array stores File ObjectIds.
    { references: fid },
  ];
  const topicDocs = await TopicItemModel.find({
    projectId: pid,
    $or: topicOr,
  })
    .select({ _id: 1 })
    .lean();

  const topicIds = topicDocs.map((t) => (t as { _id: Types.ObjectId })._id);

  // IFC viewer todos can be linked directly by object selection without topicRef.
  // Match direct links via modelId and fallback via fileUrl snapshots from file versions.
  const fileDoc = await FileModel.findById(fid)
    .select("versions.location")
    .lean();
  const versionLocations = Array.from(
    new Set(
      ((fileDoc as { versions?: Array<{ location?: string }> } | null)?.versions ??
        [])
        .map((v) => String(v.location ?? "").trim())
        .filter((s) => s.length > 0),
    ),
  );
  const directIfcLinkedOr =
    versionLocations.length > 0
      ? [{ "items.modelId": fileId }, { "items.fileUrl": { $in: versionLocations } }]
      : [{ "items.modelId": fileId }];

  const [openTodo2DCount, openTodo3DCount, openDashboardTodoCount, openDirectTodo3DCount, openDirectBoardTodoCount] =
    await Promise.all([
      Todo2DModel.countDocuments({
        projectId,
        fileId,
        isDeleted: { $ne: true },
        status: { $nin: ["Done", "Closed"] },
      }),
      topicIds.length
        ? Todo3DModel.countDocuments({
            projectId: pid,
            topicId: { $in: topicIds },
            status: { $nin: ["Done", "Closed"] },
          })
        : 0,
      topicIds.length
        ? TodoModel.countDocuments({
            projectId: pid,
            topicItemId: { $in: topicIds },
            status: { $nin: ["Done", "Closed", "done", "closed"] },
          })
        : 0,
      Todo3DModel.countDocuments({
        projectId: pid,
        status: { $nin: ["Done", "Closed"] },
        $or: directIfcLinkedOr,
      }),
      TodoModel.countDocuments({
        projectId: pid,
        status: { $nin: ["Done", "Closed", "done", "closed"] },
        $or: directIfcLinkedOr,
      }),
    ]);

  return (
    openTodo2DCount +
    openTodo3DCount +
    openDashboardTodoCount +
    openDirectTodo3DCount +
    openDirectBoardTodoCount
  );
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
    { references: fid },
  ];

  const topicDocs = await TopicItemModel.find({
    projectId: pid,
    $or: topicOr,
  })
    .select({ _id: 1, status: 1 })
    .lean();

  const unresolvedTopics = topicDocs.filter(
    (t) =>
      !["Done", "Resolved", "Closed"].includes(
        String((t as { status?: string }).status ?? ""),
      ),
  ).length;

  const openTodos = await countOpenTodosLinkedToFile(projectId, fileId);

  if (unresolvedTopics > 0 || openTodos > 0) {
    throw new AppError(
      "Cannot publish. This file has unresolved issues in the Topics module.",
      409,
    );
  }
}
