import express from "express";
import { authenticate } from "../../../middlewares/authMiddlewares"; // Giả sử bạn có middleware xác thực người dùng
import UnitService from "../services/unit.services"; // Import service

const UnitController = express.Router();

const unitService = new UnitService();

// Lấy unit theo projectId
UnitController.get("/get/:projectId", authenticate, async (req, res) => {
  try {
    const result = await unitService.getByProjectId(
      req.params.projectId,
      req.userId
    );
    res.status(200).json({
      success: true,
      message: "Lấy unit dự án thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi lấy unit dự án.",
      error: error.message,
    });
  }
});

// Cập nhật unit cho project
UnitController.put("/update/:projectId", authenticate, async (req, res) => {
  try {
    const result = await unitService.updateUnit(
      req.params.projectId,
      req.body,
      req.userId
    );

    res.status(200).json({
      success: true,
      message: "Cập nhật unit dự án thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi cập nhật unit dự án.",
      error: error.message,
    });
  }
});

export { UnitController };
