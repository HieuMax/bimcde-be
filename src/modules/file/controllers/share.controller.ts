import { Request, Response } from "express";
import ShareModel from "../schemas/share.schema";
import { AppError } from "../../../utils/AppError";
import FileService from "../services/file.service";

const fileService = new FileService();

export class ShareController {

  /**
   * GET /api/share/:token
   * Dùng để resolve token → trả fileId + projectId
   */
  async resolveShare(req: Request, res: Response) {
    const { token } = req.params;

    // 1️⃣ Check token
    const share = await ShareModel.findOne({ token }).lean();

    if (!share) {
      throw new AppError("Invalid share token", 404);
    }

    // 2️⃣ Check expire
    if (share.expiresAt && new Date() > new Date(share.expiresAt)) {
      throw new AppError("Share link expired", 410);
    }

    // 3️⃣ Trả dữ liệu để FE redirect
    return res.json({
      fileId: share.fileId.toString(),
      projectId: share.projectId?.toString() ?? null,
      accessLevel: share.accessLevel,
      type: share.type,
    });
  }
}
// bimcde-be\src\modules\file\controllers\share.controller.ts
