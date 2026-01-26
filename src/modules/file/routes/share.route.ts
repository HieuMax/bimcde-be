import express, { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import FileService from "../services/file.service"; 

const router = express.Router();
const fileService = new FileService(); 

import { ShareController } from "../controllers/share.controller";
import { AppError } from "../../../utils/AppError";
const controller = new ShareController();

router.get("/:token", asyncHandler(controller.resolveShare.bind(controller)));

router.get(
  "/file/:fileId",
  asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params;
    const { token } = req.query;

    if (!token || typeof token !== "string") {
      throw new AppError("Missing share token", 401);
    }

    const result = await fileService.getFileDetailPublic(
      fileId,
      token
    );

    return res.json(result);
  })
);

router.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { 
      fileId, 
      projectId,
      recipients,
      note, 
      type,
      expiresAt,
      accessLevel, // 1. Lấy tham số này từ Frontend gửi lên
      showLatestVersion 
    } = req.body;

    console.log("📧 SHARE REQUEST:", { fileId, projectId, recipients, accessLevel });

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
      
      // 2. Truyền vào service (Nếu không có thì mặc định là VIEW)
      accessLevel: accessLevel || "VIEW", 
      
      showLatestVersion: showLatestVersion ?? true
    });

    return res.json({
      success: true,
      ...result 
    });
  })
);
export default router;

// bimcde-be\src\modules\file\routes\share.route.ts