import express, { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import View2DService from "../services/view2d.service";
import { authenticate } from "../../../middlewares/authMiddlewares";
import View2DModel from "../schemas/view2d.schema";
import {
  actorFromReq,
  logActivitySafe,
  projectIdToString,
} from "../../activity/utils/auditActivity.helpers"; 

const View2DController = express.Router();
const view2dService = new View2DService();

View2DController.post(
  "/",
  authenticate, 
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

    const userId = (req as any).userId;
    
    if (!userId) {
      throw new AppError("Unauthorized: User ID not found", 401);
    }

    console.log("📥 [CREATE VIEW] User ID:", userId);
    console.log("📥 [CREATE VIEW] Created By:", createdBy);

    const result = await view2dService.createView({
      name,
      description,
      projectId,
      fileId,
      userId,
      // pageIndex,
      // scale,
      // rotation,
      pageIndex: Number(pageIndex),
      scale: Number(scale),
      rotation: Number(rotation),
      previewSrc,
      // createdBy,
      // updatedBy
    });

    const actor = actorFromReq(req);
    if (actor && result?._id && result.projectId) {
      await logActivitySafe({
        projectId: projectIdToString(result.projectId),
        actor,
        actionGroup: "VIEW",
        actionType: "CREATE",
        target: {
          itemId: String(result._id),
          itemModel: "View",
          itemName: String(result.name ?? "View"),
        },
        description: `Created 2D view "${String(result.name ?? "")}"`,
      });
    }

    res.status(201).json(result);
  })
);

/**
 * 
 * Lấy danh sách view của một file
 */
View2DController.get(
  "/file/:fileId",
  // authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params;
    
    const result = await view2dService.getViewsByFile(fileId);
    
    res.status(200).json(result);
  })
);

View2DController.get(
  "/project/:projectId",
  // authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;    
    const result = await view2dService.getViewsByProject(projectId);
    res.status(200).json(result);
  })
);

View2DController.put(
  "/:id",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description } = req.body;

    const userId = (req as any).userId;
    if (!userId) {
      throw new AppError("Unauthorized", 401);
    }

    const updated = await view2dService.updateView(
      id,
      { name, description },
      userId
    );

    const actor = actorFromReq(req);
    if (actor && updated?._id && updated.projectId) {
      await logActivitySafe({
        projectId: projectIdToString(updated.projectId),
        actor,
        actionGroup: "VIEW",
        actionType: "UPDATE",
        target: {
          itemId: String(updated._id),
          itemModel: "View",
          itemName: String(updated.name ?? "View"),
        },
        description: `Updated 2D view "${String(updated.name ?? "")}"`,
      });
    }

    res.json(updated);
  })
);

View2DController.delete(
  "/:id",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    const userId = (req as any).userId;
    
    if (!userId) {
      throw new AppError("Unauthorized: User ID not found", 401);
    }

    console.log("🗑️ [DELETE VIEW] View ID:", id);
    console.log("🗑️ [DELETE VIEW] User ID:", userId);

    const existing = await View2DModel.findById(id).lean();
    // Gọi service
    await view2dService.deleteView(id, userId);

    const actor = actorFromReq(req);
    if (actor && existing?._id && existing.projectId) {
      await logActivitySafe({
        projectId: projectIdToString(existing.projectId),
        actor,
        actionGroup: "VIEW",
        actionType: "DELETE",
        target: {
          itemId: String(existing._id),
          itemModel: "View",
          itemName: String((existing as { name?: string }).name ?? "View"),
        },
        description: "Deleted 2D view",
      });
    }

    res.status(200).json({ success: true, message: "View deleted successfully" });
  })
);

export default View2DController;