import express, { Request, Response } from "express";
import ViewService from "../services/view.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import { authenticate } from "../../../middlewares/authMiddlewares";

const ViewController = express.Router();
const viewService = new ViewService();

/**
 * GET /api/views?projectId=...
 */
ViewController.get(
    "/",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { projectId } = req.query;
        if (!projectId) throw new AppError("Project ID is required", 400);
        const views = await viewService.getAllViews(projectId as string);
        res.json(views);
    })
);

/**
 * POST /api/views
 */
ViewController.post(
    "/",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId;
        const viewData = { ...req.body, createdBy: userId };
        const newView = await viewService.create(viewData);
        res.status(201).json(newView);
    })
);

/**
 * PATCH /api/views/:id (Update Info Text)
 */
ViewController.patch(
    "/:id",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const userId = req.userId?.toString() as string;
        const updatedView = await viewService.updateViewInfo(id, req.body, userId);
        res.json(updatedView);
    })
);

/**
 * PUT /api/views/:id/snapshot (Update 3D State)
 */
ViewController.put(
    "/:id/snapshot",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const userId = req.userId?.toString() as string;
        // Body should contain { viewState, items }
        const updatedView = await viewService.updateSnapshot(id, req.body, userId);
        res.json(updatedView);
    })
);

/**
 * DELETE /api/views/:id
 */
ViewController.delete(
    "/:id",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const userId = req.userId?.toString() as string;
        await viewService.deleteView(id, userId);
        res.json({ message: "View deleted successfully" });
    })
);

export default ViewController;