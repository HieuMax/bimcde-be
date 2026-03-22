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
        updateData,
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
  },
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
  },
);

// Create a new topic item
TopicsController.post(
  "/items/create/:projectId",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const payload = req.body;
      const result = await topicsService.createTopicItem(
        req.userId,
        projectId,
        payload,
      );
      res.status(201).json({
        success: true,
        message: "Topic created successfully",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Error creating topic",
        error: error.message,
      });
    }
  },
);

// Update a topic item
TopicsController.put(
  "/items/:topicItemId",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { topicItemId } = req.params;
      const payload = req.body;
      const result = await topicsService.updateTopicItem(
        req.userId,
        topicItemId,
        payload,
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
  },
);

// Get all topic instances (BCF topics)
TopicsController.get(
  "/items/getAll/:projectId",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const result = await topicsService.getAllTopicItems(
        req.userId,
        projectId,
      );
      res.status(200).json({
        success: true,
        message: "Topic items retrieved successfully",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Error retrieving topic items",
        error: error.message,
      });
    }
  },
);

TopicsController.post(
  "/items/:topicItemId/attachments",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { topicItemId } = req.params;
      const { attachments } = req.body;
      const result = await topicsService.addTopicAttachments(
        req.userId,
        topicItemId,
        attachments,
      );

      res.status(200).json({
        success: true,
        message: "Topic attachments added successfully",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Error adding topic attachments",
        error: error.message,
      });
    }
  },
);

TopicsController.delete(
  "/items/:topicItemId/attachments",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { topicItemId } = req.params;
      const { url } = req.body ?? {};

      const result = url
        ? await topicsService.removeTopicAttachment(
            req.userId,
            topicItemId,
            url,
          )
        : await topicsService.removeAllTopicAttachments(req.userId, topicItemId);

      res.status(200).json({
        success: true,
        message: url
          ? "Topic attachment removed successfully"
          : "Topic attachments removed successfully",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Error removing topic attachment(s)",
        error: error.message,
      });
    }
  },
);

export default TopicsController;
