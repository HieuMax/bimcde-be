import express, { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import ExplorerService from "../services/explorer.service";

const ExplorerController = express.Router();
const explorerService = new ExplorerService();

/**
 * GET /api/comments/:targetId
 * Query Params: { projectId, folderId, sortBy, sortOrder }
 * Desc: Get files and folders in a project/folder with sorting.
 */
ExplorerController.get(
  "/content",
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, folderId, sortBy, sortOrder } = req.query;

    if (!projectId) throw new AppError("Project ID is required", 400);

    const validSortBy = (sortBy as string) || "name";
    const validSortOrder = sortOrder === "desc" ? "desc" : "asc";
    const validFolderId =
      folderId && folderId !== "null" && folderId !== "undefined"
        ? (folderId as string)
        : null;

    const data = await explorerService.getExplorerContent(
      projectId as string,
      validFolderId,
      validSortBy,
      validSortOrder
    );

    res.json(data);
  })
);

export { ExplorerController };
