import express, { Request, Response } from "express";
import Topic3DService from "../services/topic3d.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import { authenticate } from "../../../middlewares/authMiddlewares";

const Topic3DController = express.Router();
const topic3dService = new Topic3DService();

Topic3DController.get(
    "/project/:projectId",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        console.log("📥 [POST /topic3d] Body nhận được từ FE:", req.body);
        
        const { projectId } = req.params;
        const { status, search } = req.query;
        const topics = await topic3dService.getTopics3DByProject(projectId, { status, search });
        res.json(topics);
    })
);

Topic3DController.post(
    "/",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId;
        const topicData = { ...req.body, createdBy: userId };
        const newTopic = await topic3dService.createTopic3D(topicData);
        res.status(201).json(newTopic);
    })
);

Topic3DController.post(
    "/:id/snapshots",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId?.toString() as string;
        const { id } = req.params;
        const updatedTopic = await topic3dService.addSnapshot(id, req.body, userId);
        res.json(updatedTopic);
    })
);

Topic3DController.patch(
    "/:id",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId?.toString() as string;
        const { id } = req.params;
        const updateTopic = await topic3dService.updateTopic(id, req.body, userId);
        res.json(updateTopic);
    })
)

Topic3DController.delete(
    "/:id",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        await topic3dService.deleteTopic(id);
        res.json({ message: "Topic deleted successfully" });
    })
);

export default Topic3DController;