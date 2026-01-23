import { Types } from "mongoose";
import CommentModel from "../schemas/comment.schema";
import { AppError } from "../../../utils/AppError";

export default class CommentService {
  // --- US41: GET LIST COMMENTS OF FILE/FOLDER ---
  async getComments(targetId: string, limit: number, offset: number) {
    const [comments, total] = await Promise.all([
      CommentModel.find({ targetId })
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("createdBy", "fullName avatar")
        .lean(),
      CommentModel.countDocuments({ targetId }),
    ]);

    return { comments, total, hasMore: offset + limit < total };
  }

  // --- US41: CREATE COMMENT ---
  async createComment(data: {
    content: string;
    targetId: string;
    targetType: "file" | "folder" | "release" | "view";
    userId: string;
  }) {
    const newComment = new CommentModel({
      content: data.content,
      targetId: new Types.ObjectId(data.targetId),
      targetType: data.targetType,
      createdBy: new Types.ObjectId(data.userId),
    });
    const savedComment = await newComment.save();
    return await savedComment.populate("createdBy", "fullName avatar");
  }

  // --- US41: UPDATE COMMENT ---
  async updateComment(id: string, content: string, userId: string) {
    const comment = await CommentModel.findOneAndUpdate(
      { _id: id, createdBy: userId },
      { content },
      { new: true }
    ).populate("createdBy", "fullName avatar");

    if (!comment)
      throw new AppError("Comment not found or permission denied", 403);
    return comment;
  }

  // --- US41: DELETE COMMENT ---
  async deleteComment(id: string, userId: string) {
    const comment = await CommentModel.findOneAndDelete({
      _id: id,
      createdBy: userId,
    });
    if (!comment)
      throw new AppError("Comment not found or permission denied", 403);
    return true;
  }
}
