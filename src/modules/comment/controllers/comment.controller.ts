import express, { Request, Response } from "express";
import CommentService from "../services/comment.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import FileModel from "../../file/schemas/file.schema";
import FolderModel from "../../folder/schemas/folder.schema";
import AccountModel from "../../account/schemas/account.schema";
import CommentModel from "../schemas/comment.schema";
import {
  logActivitySafe,
  projectIdToString,
} from "../../activity/utils/auditActivity.helpers";

const CommentController = express.Router();

async function resolveCommentContext(targetId: string, targetType: string) {
  const t = String(targetType).toLowerCase();
  if (t === "file") {
    const f = await FileModel.findById(targetId).select("projectId name").lean();
    if (!f?.projectId) return null;
    return {
      projectId: projectIdToString(f.projectId),
      label: f.name ?? "File",
    };
  }
  if (t === "folder") {
    const f = await FolderModel.findById(targetId).select("projectId name").lean();
    if (!f?.projectId) return null;
    return {
      projectId: projectIdToString(f.projectId),
      label: f.name ?? "Folder",
    };
  }
  return null;
}

async function actorFromBodyUserId(userId: string) {
  const u = await AccountModel.findById(userId).lean();
  if (!u?._id) return null;
  return {
    userId: u._id,
    fullName: u.fullName ?? "User",
    email: u.email,
  };
}
const commentService = new CommentService();

/**
 * GET /api/comments/:targetId
 * Query Params: limit (default 6), offset (default 0)
 * Desc: Get a list of comments for a file/folder.
 */
CommentController.get(
  "/:targetId",
  asyncHandler(async (req: Request, res: Response) => {
    const { targetId } = req.params;
    const limit = parseInt(req.query.limit as string) || 6;
    const offset = parseInt(req.query.offset as string) || 0;

    if (!targetId) throw new AppError("Target ID is required", 400);

    const data = await commentService.getComments(targetId, limit, offset);
    res.json(data);
  })
);
/**
 * POST /api/comments
 * Body: { content, targetId, targetType, userId }
 * Desc: Create new comment for a file/folder.
 */
CommentController.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { content, targetId, targetType, userId } = req.body;

    // Validate cơ bản (Nên dùng Zod middleware sau này)
    if (!content || !targetId || !targetType || !userId) {
      throw new AppError("Missing required fields", 400);
    }

    const newComment = await commentService.createComment({
      content,
      targetId,
      targetType,
      userId,
    });
    const ctx = await resolveCommentContext(targetId, targetType);
    const actor = await actorFromBodyUserId(String(userId));
    if (actor && ctx && newComment?._id) {
      await logActivitySafe({
        projectId: ctx.projectId,
        actor,
        actionGroup: "COMMENT",
        actionType: "CREATE",
        target: {
          itemId: String(newComment._id),
          itemModel: "Comment",
          itemName: `Comment on ${ctx.label}`,
        },
        metaData: { targetType, targetId },
      });
    }
    res.status(201).json(newComment);
  })
);

/**
 * PUT /api/comments/:id
 * Body: { content, userId }
 * Desc: Edit comment (Only the owner can edit)
 */
CommentController.put(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { content, userId } = req.body;

    if (!content || !userId)
      throw new AppError("Content and UserId required", 400);

    const prev = await CommentModel.findById(id).lean();
    const updated = await commentService.updateComment(id, content, userId);
    const actor = await actorFromBodyUserId(String(userId));
    if (actor && prev && updated) {
      const ctx = await resolveCommentContext(
        String(prev.targetId),
        String(prev.targetType),
      );
      if (ctx) {
        await logActivitySafe({
          projectId: ctx.projectId,
          actor,
          actionGroup: "COMMENT",
          actionType: "UPDATE",
          target: {
            itemId: String(updated._id),
            itemModel: "Comment",
            itemName: `Comment on ${ctx.label}`,
          },
        });
      }
    }
    res.json(updated);
  })
);

/**
 * DELETE /api/comments/:id
 * Body: { userId } - Cần userId để check quyền xóa
 * Desc: Delete comment (Only the owner can delete)
 */
CommentController.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) throw new AppError("UserId required", 400);

    const prev = await CommentModel.findById(id).lean();
    await commentService.deleteComment(id, userId);
    const actor = await actorFromBodyUserId(String(userId));
    if (actor && prev?._id) {
      const ctx = await resolveCommentContext(
        String(prev.targetId),
        String(prev.targetType),
      );
      if (ctx) {
        await logActivitySafe({
          projectId: ctx.projectId,
          actor,
          actionGroup: "COMMENT",
          actionType: "DELETE",
          target: {
            itemId: String(prev._id),
            itemModel: "Comment",
            itemName: `Comment on ${ctx.label}`,
          },
        });
      }
    }
    res.json({ message: "Deleted successfully" });
  })
);

export { CommentController };
