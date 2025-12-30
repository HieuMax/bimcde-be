import express, { Request, Response } from "express";
import CommentService from "../services/comment.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";

const CommentController = express.Router();
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

    const updated = await commentService.updateComment(id, content, userId);
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

    await commentService.deleteComment(id, userId);
    res.json({ message: "Deleted successfully" });
  })
);

export { CommentController };
