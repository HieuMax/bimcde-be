import express, { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import { authenticate } from "../../../middlewares/authMiddlewares";
import ExplorerService from "../services/explorer.service";

const ExplorerController = express.Router();
const explorerService = new ExplorerService();

/**
 * GET /api/explorer/group-home-folder
 * ISO: folder directly under a CDE root (1. WIP / 2. Shared / …) for this group.
 */
ExplorerController.get(
  "/group-home-folder",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, groupId, cdeStage } = req.query;
    if (!projectId || typeof projectId !== "string") {
      throw new AppError("Project ID is required", 400);
    }
    if (!groupId || typeof groupId !== "string") {
      throw new AppError("groupId is required", 400);
    }
    const stage =
      typeof cdeStage === "string" && cdeStage.length > 0 ? cdeStage : "WIP";
    if (!req.userId) throw new AppError("Unauthorized", 401);
    const data = await explorerService.getGroupHomeFolderId(
      projectId,
      groupId,
      stage,
      req.userId
    );
    res.json(data);
  })
);

/**
 * GET /api/explorer/cde-root-folder
 * ISO: CDE root folder id (1. WIP … 4. Archived) for browsing / promote destination.
 */
ExplorerController.get(
  "/cde-root-folder",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, cdeStage } = req.query;
    if (!projectId || typeof projectId !== "string") {
      throw new AppError("Project ID is required", 400);
    }
    const stage =
      typeof cdeStage === "string" && cdeStage.length > 0 ? cdeStage : "WIP";
    if (!req.userId) throw new AppError("Unauthorized", 401);
    const data = await explorerService.getCdeRootFolderId(
      projectId,
      stage,
      req.userId
    );
    res.json(data);
  })
);

/**
 * GET /api/comments/:targetId
 * Query Params: { projectId, folderId, sortBy, sortOrder }
 * Desc: Get files and folders in a project/folder with sorting.
 */
ExplorerController.get(
  "/content",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, folderId, sortBy, sortOrder, restrictMoveToEffectiveGroupId } =
      req.query;

    if (!projectId) throw new AppError("Project ID is required", 400);

    const validSortBy = (sortBy as string) || "name";
    const validSortOrder = sortOrder === "desc" ? "desc" : "asc";
    const validFolderId =
      folderId && folderId !== "null" && folderId !== "undefined"
        ? (folderId as string)
        : null;

    const restrictGroup =
      typeof restrictMoveToEffectiveGroupId === "string" &&
      restrictMoveToEffectiveGroupId.length > 0
        ? restrictMoveToEffectiveGroupId
        : undefined;

    const data = await explorerService.getExplorerContent(
      projectId as string,
      validFolderId,
      validSortBy,
      validSortOrder,
      req.userId,
      restrictGroup
    );

    res.json(data);
  })
);

export { ExplorerController };
