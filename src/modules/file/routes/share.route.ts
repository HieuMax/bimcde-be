import express, { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
// [QUAN TRỌNG] Import Service để dùng tính năng gửi mail
import FileService from "../services/file.service"; 

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
  asyncHandler(async (req: Request, res: Response) => {
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

    const result = await fileService.shareFile({
      fileId,
      projectId,
      userId: null,
      type: type || "PUBLIC_LINK",
      recipients: recipients || [],
      note,
      expiresAt,
      accessLevel: "VIEW",
      showLatestVersion: true
    });

    return res.json({
      success: true,
      ...result 
    });
  })
);

export default router;
