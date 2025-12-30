import express, { Request, Response } from "express";
import FolderService from "../services/folder.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";

const FolderController = express.Router();
const folderService = new FolderService();

// GET /api/folders?projectId=...&parentId=...
FolderController.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, parentId } = req.query;

    if (!projectId) throw new AppError("Project ID is required", 400);

    const folders = await folderService.getFolderContents(
      projectId as string,
      (parentId as string) || null
    );
    res.json(folders);
  })
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
  })
);

// PUT /api/folders/:id/rename
FolderController.put(
  "/:id/rename",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, userId } = req.body;

    if (!name) throw new AppError("New name is required", 400);

    const updated = await folderService.renameFolder(id, name, userId);
    res.json(updated);
  })
);

// DELETE /api/folders/:id
FolderController.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId } = req.body;

    await folderService.deleteFolder(id, userId);
    res.json({ message: "Folder deleted successfully" });
  })
);

FolderController.get("/getAll", async (req: Request, res: Response) => {
  try {
    const folders = await folderService.getAllFolders();
    res.json(folders);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/folders/:id/move
FolderController.put(
  "/:id/move",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { destinationParentId, userId } = req.body;

    const result = await folderService.moveFolder(
      id,
      destinationParentId,
      userId
    );
    res.json(result);
  })
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
  })
);

export { FolderController };
