import express, { Request, Response } from "express";
import ActivityService from "../services/activity.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import { authenticate } from "../../../middlewares/authMiddlewares";

const ActivityController = express.Router();
const activityService = new ActivityService();

// GET /api/activities?projectId=...
// Filters: &userId=...&actionGroup=...&startDate=...&endDate=...&page=1&limit=20
ActivityController.get(
  "/",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const {
      projectId,
      userId,
      groupIds,
      actionGroup,
      actionTypes,
      startDate,
      endDate,
      page,
      limit,
    } = req.query;

    if (!projectId) {
      throw new AppError("Project ID is required", 400);
    }

    const result = await activityService.getActivities(projectId as string, {
      userId: userId as string,
      groupIds: groupIds as string,
      actionGroup: actionGroup as string,
      actionTypes: actionTypes as string,
      startDate: startDate as string,
      endDate: endDate as string,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20,
    });

    res.json(result);
  }),
);

// POST /api/activities (Optional - Dành cho custom log từ FE nếu cần)
ActivityController.post(
  "/",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    // Validate cơ bản
    const { projectId, actionGroup, actionType } = req.body;
    if (!projectId || !actionGroup || !actionType) {
      throw new AppError("Missing required fields", 400);
    }

    const newActivity = await activityService.logActivity(req.body);
    res.status(201).json(newActivity);
  }),
);

export { ActivityController };
