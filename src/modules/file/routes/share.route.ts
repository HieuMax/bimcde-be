import express, { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import { authenticate } from "../../../middlewares/authMiddlewares";
// [QUAN TRỌNG] Import Service để dùng tính năng gửi mail
import FileService from "../services/file.service";
import FileModel from "../schemas/file.schema";
import {
  actorFromReq,
  logActivitySafe,
  projectIdToString,
} from "../../activity/utils/auditActivity.helpers"; 

const router = express.Router();
// Khởi tạo Service
const fileService = new FileService(); 

import { ShareController } from "../controllers/share.controller";
const controller = new ShareController();

router.get("/:token", asyncHandler(controller.resolveShare.bind(controller)));

router.get(
  "/file/:fileId", 
  asyncHandler(controller.getPublicFileDetail.bind(controller))
);
// API TẠO SHARE & GỬI MAIL (POST)
router.post(
  "/",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.userId?.toString();
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const { 
      fileId, 
      projectId,
      recipients,
      note, 
      type,
      expiresAt 
    } = req.body;

    console.log("📧 SHARE REQUEST:", { fileId, projectId, recipients });

    if (!fileId) {
      return res.status(400).json({ message: "Thiếu fileId" });
    }

    const shareType = type || "PUBLIC_LINK";
    const result = await fileService.shareFile({
      fileId,
      projectId,
      userId,
      type: shareType,
      recipients: recipients || [],
      note,
      expiresAt,
      accessLevel: "VIEW",
      showLatestVersion: true
    });

    const actor = actorFromReq(req);
    if (actor && result.share) {
      const sid = result.share.fileId;
      const fileIdStr = sid != null ? String(sid) : String(fileId);
      const fileDoc = await FileModel.findById(fileIdStr).select("name").lean();
      await logActivitySafe({
        projectId: projectIdToString(result.share.projectId),
        actor,
        actionGroup: "FILE",
        actionType: "SHARE_LINK",
        target: {
          itemId: fileIdStr,
          itemModel: "File",
          itemName: fileDoc?.name ?? "File",
        },
        description: `Created ${shareType} share link for "${fileDoc?.name ?? "file"}"`,
        metaData: {
          shareType,
          recipientCount: Array.isArray(recipients) ? recipients.length : 0,
          expiresAt: expiresAt ?? null,
        },
      });
    }

    return res.json({
      success: true,
      ...result 
    });
  })
);

export default router;
