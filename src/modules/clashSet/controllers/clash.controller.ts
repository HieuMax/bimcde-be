import express, { Request, Response } from "express";
import ClashService from "../services/clash.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import { authenticate } from "../../../middlewares/authMiddlewares";

const ClashController = express.Router();
const clashService = new ClashService();

/**
 * GET /api/clash-sets?projectId=...
 */
ClashController.get(
    "/",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { projectId } = req.query;
        if (!projectId) throw new AppError("Project ID is required", 400);
        const data = await clashService.getAll(projectId as string);
        res.json(data);
    })
);

/**
 * GET /api/clash-sets/:id
 */
ClashController.get(
    "/:id",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const data = await clashService.getById(id);
        res.json(data);
    })
);

/**
 * POST /api/clash-sets
 */
ClashController.post(
    "/",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId?.toString() as string;
        const newData = await clashService.create(req.body, userId);
        res.status(201).json(newData);
    })
);

/**
 * PATCH /api/clash-sets/:id
 */
ClashController.patch(
    "/:id",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const updatedData = await clashService.update(id, req.body);
        res.json(updatedData);
    })
);

/**
 * DELETE /api/clash-sets/:id
 */
ClashController.delete(
    "/:id",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        await clashService.delete(id);
        res.json({ message: "Clash set deleted successfully" });
    })
);

export default ClashController;