import { Request, Response, NextFunction } from "express";
import ShareModel from "../schemas/share.schema";
import FileModel from "../schemas/file.schema";
import { AppError } from "../../../utils/AppError";
import FileService from "../services/file.service";
const fileService = new FileService();
export class ShareController {
  async resolveShare(req: Request, res: Response, next: NextFunction) {
    try {
      const { token } = req.params;

      const share = await ShareModel.findOne({ token }).lean();
      if (!share) {
        throw new AppError("Share link invalid", 404);
      }

      if (share.expiresAt && new Date() > share.expiresAt) {
        throw new AppError("Share link expired", 410);
      }

      return res.json({
        fileId: share.fileId.toString(),
        projectId: share.projectId?.toString() ?? null,
        accessLevel: share.accessLevel,
        type: share.type,
      });
    } catch (err) {
      next(err);
    }
  }

  async getPublicFileDetail(req: Request, res: Response, next: NextFunction) {
    try {
      const { fileId } = req.params;
      const { shareToken } = req.query;

      if (!shareToken || typeof shareToken !== "string") {
        throw new AppError("Missing share token", 401);
      }

      console.log("👉 ShareController hit: getPublicFileDetail", { fileId });
      
      const result = await fileService.getFileDetailPublic(fileId, shareToken);
      return res.json(result);
    } catch (err) { next(err); }
  }
}
