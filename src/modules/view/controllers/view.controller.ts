import express, { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import ViewService from "../services/view.service";
import { authenticate } from "../../../middlewares/authMiddlewares"; // Middleware xác thực

const ViewController = express.Router();
const viewService = new ViewService();

/**
 * POST /api/views
 * Tạo view mới
 */
ViewController.post(
  "/",
  authenticate, // 👈 Bắt buộc phải đăng nhập
  asyncHandler(async (req: Request, res: Response) => {
    const { 
      name, 
      description, 
      projectId, 
      fileId, 
      pageIndex, 
      scale, 
      rotation, 
      previewSrc,
      createdBy,
      updatedBy
    } = req.body;

    // Validate cơ bản
    if (!name || !fileId || !projectId) {
      throw new AppError("Missing required fields (name, fileId, projectId)", 400);
    }

    // 👈 Lấy userId từ middleware authenticate (req.userId được set bởi middleware)
    const userId = (req as any).userId;
    
    if (!userId) {
      throw new AppError("Unauthorized: User ID not found", 401);
    }

    console.log("📥 [CREATE VIEW] User ID:", userId);
    console.log("📥 [CREATE VIEW] Created By:", createdBy);

    const result = await viewService.createView({
      name,
      description,
      projectId,
      fileId,
      userId,
      pageIndex,
      scale,
      rotation,
      previewSrc,
      // createdBy,
      // updatedBy
    });

    res.status(201).json(result);
  })
);

/**
 * GET /api/views/file/:fileId
 * Lấy danh sách view của một file
 */
ViewController.get(
  "/file/:fileId",
  // authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params;
    
    const result = await viewService.getViewsByFile(fileId);
    
    res.status(200).json(result);
  })
);

ViewController.put(
  "/:id",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description } = req.body;

    const userId = (req as any).userId;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const updated = await viewService.updateView(
      id,
      { name, description },
      userId
    );


    res.json(updated);
  })
);


ViewController.delete(
  "/:id",
  authenticate, // 👈 Bắt buộc xác thực
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    // 👈 Lấy userId thực từ middleware
    const userId = (req as any).userId;
    
    if (!userId) {
      throw new AppError("Unauthorized: User ID not found", 401);
    }

    console.log("🗑️ [DELETE VIEW] View ID:", id);
    console.log("🗑️ [DELETE VIEW] User ID:", userId);

    // Gọi service
    await viewService.deleteView(id, userId);

    res.status(200).json({ success: true, message: "View deleted successfully" });
  })
);

export default ViewController;