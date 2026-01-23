import express, { Request, Response } from "express";
import FolderService from "../services/folder.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import { auditLog } from "../../../middlewares/auditLog.middleware";
import { authenticate } from "../../../middlewares/authMiddlewares";
import FolderModel from "../schemas/folder.schema";
import ActivityService from "../../activity/services/activity.service";

const FolderController = express.Router();
const folderService = new FolderService();
const activityService = new ActivityService();
// GET /api/folders?projectId=...&parentId=...
FolderController.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, parentId } = req.query;

    if (!projectId) throw new AppError("Project ID is required", 400);

    const folders = await folderService.getFolderContents(
      projectId as string,
      (parentId as string) || null,
    );
    res.json(folders);
  }),
);

// POST /api/folders (Create)
FolderController.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { name, projectId, parentId, createdBy } = req.body;

    if (!name || !projectId)
      throw new AppError("Name and ProjectID required", 400);

    const newFolder = await folderService.createFolder({
      name,
      projectId,
      parentId,
      createdBy,
    });
    res.status(201).json(newFolder);
  }),
);

// PUT /api/folders/:id/rename
FolderController.put(
  "/:id/rename",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, userId } = req.body;

    console.log("Rename request body:", req.body);
    console.log("Folder ID to rename:", id);

    if (!name) throw new AppError("New name is required", 400);

    // 1. Lấy tên cũ (Bạn cần đảm bảo FolderService có hàm getById hoặc dùng Model trực tiếp)
    // Giả sử dùng service hoặc model
    // Cách trên hơi hack, tốt nhất import FolderModel để tìm
    const currentFolder = await FolderModel.findById(id);
    if (!currentFolder) throw new AppError("Folder not found", 404);
    const oldName = currentFolder.name || "Unnamed Folder";

    // 2. Rename
    const updated = await folderService.renameFolder(id, name, userId);

    // 3. Log
    await activityService.logActivity({
      projectId: updated.projectId,
      actor: {
        userId: req.user!._id,
        fullName: req.user!.fullName,
        email: req.user!.email,
      },
      actionGroup: "FOLDER",
      actionType: "RENAME",
      target: {
        itemId: updated._id,
        itemModel: "Folder",
        itemName: updated.name,
      },
      description: `Renamed folder from "${oldName}" to "${updated.name}"`,
      metaData: {
        oldName: oldName,
        newName: updated.name,
      },
    });

    res.json(updated);
  }),
);

// DELETE /api/folders/:id
FolderController.delete(
  "/:id",
  authenticate,
  auditLog("FOLDER", "DELETE", (req, resBody) => ({
    itemId: req.params.id,
    itemName: resBody?.folderName || "Folder Deleted",
    itemModel: "Folder",
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId?.toString() || req.body.userId;

    const deletedFolder = await folderService.deleteFolder(id, userId);
    res.json({
      message: "Folder deleted successfully",
      projectId: deletedFolder.projectId,
      folderName: deletedFolder.name,
    });
  }),
);

FolderController.get("/getAll", async (req: Request, res: Response) => {
  try {
    const folders = await folderService.getAllFolders();
    res.json(folders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

FolderController.post(
  "/:id/restore",
  authenticate,
  auditLog("FOLDER", "RESTORE", (req, resBody) => ({
    itemId: req.params.id,
    itemName: resBody?.folderName || "Folder Restored",
    itemModel: "Folder",
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId?.toString() || req.body.userId;
    const restoredFolder = await folderService.restoreFolder(id, userId);
    res.json({
      message: "Folder restored successfully",
      projectId: restoredFolder.projectId,
      folderName: restoredFolder.name,
    });
  }),
);

// PUT /api/folders/:id/move
FolderController.put(
  "/:id/move",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { destinationParentId, userId } = req.body;

    const result = await folderService.moveFolder(
      id,
      destinationParentId,
      userId,
    );
    res.json(result);
  }),
);

// POST /api/folders/bulk-tags
FolderController.post(
  "/bulk-tags",
  asyncHandler(async (req: Request, res: Response) => {
    const { folderIds, tagIds } = req.body;
    if (!folderIds || !Array.isArray(folderIds)) {
      throw new AppError("folderIds must be an array", 400);
    }
    const result = await folderService.assignTags(folderIds, tagIds || []);
    res.json(result);
  }),
);

export { FolderController };
