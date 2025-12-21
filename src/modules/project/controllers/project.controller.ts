import { Request, Response } from "express";
import express from "express";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { authenticate } from "../../../middlewares/authMiddlewares";
import ProjectService from "../services/project.services";
import authorize from "../../../middlewares/authorize";
const ProjectController = express.Router();

const projectService = new ProjectService();
ProjectController.post("/createProject", authenticate, async (req, res) => {
  try {
    const result = await projectService.createProject(req.userId, req.body);

    res.status(201).json({
      success: true,
      message: "Dự án đã được tạo thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi tạo dự án.",
      error: error.message,
    });
  }
});

ProjectController.get("/getAllProject", authenticate, async (req, res) => {
  try {
    const userId = req.userId;
    const result = await projectService.getAllProject(userId);
    res.status(200).json({
      success: true,
      message: "Lấy danh sách dự án thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi lấy danh sách dự án.",
      error: error.message,
    });
  }
});

ProjectController.get(
  "/getProject/:projectId",
  authenticate,
  async (req, res) => {
    try {
      const result = await projectService.getProjectById(
        req.userId,
        req.params.projectId
      );
      res.status(200).json({
        success: true,
        message: "Lấy dự án thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi lấy dự án.",
        error: error.message,
      });
    }
  }
);

ProjectController.put(
  "/updateVisited/:projectId",
  authenticate,
  async (req, res) => {
    try {
      const result = await projectService.updateProject(
        req.params.projectId,
        req.userId,
        req.body
      );
      res.status(200).json({
        success: true,
        message: "Cập nhật dự án thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi cập nhật dự án.",
        error: error.message,
      });
    }
  }
);

ProjectController.put(
  "/updateProject/:projectId",
  authenticate,
  async (req, res) => {
    try {
      const result = await projectService.updateProject(
        req.params.projectId,
        req.userId,
        req.body
      );
      res.status(200).json({
        success: true,
        message: "Cập nhật dự án thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi cập nhật dự án.",
        error: error.message,
      });
    }
  }
);

ProjectController.put(
  "/leaveProject/:projectId",
  authenticate,
  async (req, res) => {
    try {
      const result = await projectService.leaveProject(
        req.userId,
        req.params.projectId
      );

      res.status(200).json({
        success: true,
        message: "Rời dự án thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi rời dự án.",
        error: error.message,
      });
    }
  }
);

ProjectController.delete(
  "/deleteProject/:projectId",
  authenticate,
  async (req, res) => {
    try {
      const result = await projectService.deleteProject(
        req.userId,
        req.params.projectId
      );

      res.status(200).json({
        success: true,
        message: "Xóa dự án thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi xóa dự án.",
        error: error.message,
      });
    }
  }
);

export { ProjectController };
