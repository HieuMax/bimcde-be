import express from "express";
import { authenticate } from "../../../middlewares/authMiddlewares";
import TeamService from "../services/team.services";

const TeamController = express.Router();

const teamService = new TeamService();

TeamController.get(
  "/getMemberProject/:projectId",
  authenticate,
  async (req, res) => {
    try {
      const result = await teamService.getByProjectId(
        req.params.projectId,
        req.userId // Truyền userId từ middleware authenticate
      );
      res.status(200).json({
        success: true,
        message: "Lấy danh sách thành viên thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi lấy danh sách thành viên.",
        error: error.message,
      });
    }
  }
);

TeamController.get("/getGroup/:projectId", authenticate, async (req, res) => {
  try {
    const result = await teamService.getAllGroup(
      req.params.projectId,
      req.userId
    );
    res.status(200).json({
      success: true,
      message: "Lấy danh sách group thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi lấy danh sách group.",
      error: error.message,
    });
  }
});

TeamController.post(
  "/createGroup/:projectId",
  authenticate,
  async (req, res) => {
    try {
      const result = await teamService.createGroup(
        req.params.projectId,
        req.userId,
        req.body.name
      );
      res.status(200).json({
        success: true,
        message: "Tạo group thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi tạo group.",
        error: error.message,
      });
    }
  }
);

TeamController.post(
  "/addPeopleToGroup/:groupId",
  authenticate,
  async (req, res) => {
    try {
      const result = await teamService.addPeopleToGroup(
        req.params.groupId,
        req.body,
        req.userId
      );
      res.status(200).json({
        success: true,
        message: "Thêm thành viên vào group thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi thêm thành viên vào group.",
        error: error.message,
      });
    }
  }
);

TeamController.get(
  "/getMemberGroup/:groupId",
  authenticate,
  async (req, res) => {
    try {
      const result = await teamService.getMemberGroup(
        req.params.groupId,
        req.userId
      );
      res.status(200).json({
        success: true,
        message: "Lấy danh sách thành viên thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi lấy danh sách thành viên.",
        error: error.message,
      });
    }
  }
);

TeamController.put("/updateGroup/:groupId", authenticate, async (req, res) => {
  try {
    const result = await teamService.updateGroup(
      req.userId,
      req.params.groupId,
      req.body.name
    );
    res.status(200).json({
      success: true,
      message: "Cập nhật group thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi cập nhật group.",
      error: error.message,
    });
  }
});

TeamController.delete(
  "/deleteGroup/:groupId",
  authenticate,
  async (req, res) => {
    try {
      const result = await teamService.deleteGroup(
        req.params.groupId,
        req.userId
      );
      res.status(200).json({
        success: true,
        message: "Xóa group thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi xóa group.",
        error: error.message,
      });
    }
  }
);

TeamController.post(
  "/removeMemberFromGroup/:groupId",
  authenticate,
  async (req, res) => {
    try {
      const result = await teamService.removeMemberFromGroup(
        req.params.groupId,
        req.body.userId,
        req.userId
      );
      res.status(200).json({
        success: true,
        message: "Xóa thành viên khỏi group thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi xóa thành viên khỏi group.",
        error: error.message,
      });
    }
  }
);

TeamController.post("/getAllGroupByUserId", authenticate, async (req, res) => {
  try {
    const result = await teamService.getGroupByUserId(
      req.userId,
      req.body.userId
    );
    res.status(200).json({
      success: true,
      message: "Lấy nhóm theo userId thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi lấy nhóm theo userId.",
      error: error.message,
    });
  }
});

TeamController.post(
  "/addGroupToPeople/:userId",
  authenticate,
  async (req, res) => {
    try {
      const result = await teamService.addGroupToPeople(
        req.params.userId,
        req.body,
        req.userId
      );
      res.status(200).json({
        success: true,
        message: "Thêm thành viên vào group thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi thêm thành viên vào group.",
        error: error.message,
      });
    }
  }
);

export { TeamController };
