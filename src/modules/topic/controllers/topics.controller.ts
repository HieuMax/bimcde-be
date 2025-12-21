import { Request, Response } from "express";
import express from "express";
import { Types } from "mongoose";
import { authenticate } from "../../../middlewares/authMiddlewares";
import TopicsService from "../services/topics.services";

const TopicsController = express.Router();
const topicsService = new TopicsService();

// Update a topic
TopicsController.put(
  "/update/:projectId",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const updateData = req.body;
      const result = await topicsService.updateTopic(
        req.userId,
        projectId,
        updateData
      );
      res.status(200).json({
        success: true,
        message: "Topic updated successfully",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Error updating topic",
        error: error.message,
      });
    }
  }
);

// Get all topics for a project
TopicsController.get(
  "/getAll/:projectId",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const result = await topicsService.getAllTopics(req.userId, projectId);
      res.status(200).json({
        success: true,
        message: "All topics retrieved successfully",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Error retrieving all topics",
        error: error.message,
      });
    }
  }
);

export default TopicsController;
