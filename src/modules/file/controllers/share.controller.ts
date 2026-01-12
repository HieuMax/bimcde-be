import express, { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import ShareModel from "../schemas/share.schema";
import FileModel from "../schemas/file.schema";

const ShareController = express.Router();

/**
 * GET /api/share/:token
 * Desc: Open shared file by token (PUBLIC / INTERNAL)
 */
ShareController.get(
  "/:token",
  asyncHandler(async (req: Request, res: Response) => {
    const { token } = req.params;

    // 1️⃣ Find share record
    const share = await ShareModel.findOne({ token });
    if (!share) {
      throw new AppError("Share link not found or invalid", 404);
    }

    // 2️⃣ Check expiration
    if (share.expiresAt && new Date() > share.expiresAt) {
      throw new AppError("Share link has expired", 410);
    }

    // 3️⃣ Get file
    const file = await FileModel.findById(share.fileId);
    if (!file) {
      throw new AppError("File not found", 404);
    }

    // 4️⃣ Return data
    res.json({
      success: true,
      data: {
        file,
        accessLevel: share.accessLevel,
        showLatestVersion: share.showLatestVersion,
        sharedBy: share.sharedBy,
        type: share.type,
      },
    });
  })
);

export { ShareController };
