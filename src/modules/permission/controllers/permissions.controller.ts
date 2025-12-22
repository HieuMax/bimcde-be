import express from "express";
import { authenticate } from "../../../middlewares/authMiddlewares"; // Giả sử bạn có middleware xác thực người dùng
import PermissionsService from "../services/permissions.services"; // Import service

const PermissionsController = express.Router();

const permissionsService = new PermissionsService();

// Lấy permissions theo projectId
PermissionsController.get("/get/:projectId", authenticate, async (req, res) => {
  try {
    const result = await permissionsService.getByProjectId(
      req.params.projectId,
      req.userId // Truyền userId từ middleware authenticate
    );
    res.status(200).json({
      success: true,
      message: "Lấy quyền dự án thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi lấy quyền dự án.",
      error: error.message,
    });
  }
});

// Cập nhật permissions cho project
PermissionsController.put(
  "/update/:projectId",
  authenticate,
  async (req, res) => {
    try {
      const result = await permissionsService.updatePermissions(
        req.params.projectId,
        req.body,
        req.userId // Truyền userId từ middleware authenticate
      );

      res.status(200).json({
        success: true,
        message: "Cập nhật quyền dự án thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi cập nhật quyền dự án.",
        error: error.message,
      });
    }
  }
);

export { PermissionsController };
