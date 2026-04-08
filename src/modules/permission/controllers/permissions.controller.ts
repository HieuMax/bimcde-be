import express, { Request, Response } from "express";
import { authenticate } from "../../../middlewares/authMiddlewares"; // Giả sử bạn có middleware xác thực người dùng
import PermissionsService from "../services/permissions.services"; // Import service
import { asyncHandler } from "../../../utils/asyncHandler";
import ItemAclService from "../services/item-acl.service";

const PermissionsController = express.Router();

const permissionsService = new PermissionsService();
const itemAclService = new ItemAclService();

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

/** Per-folder / per-file ACL (explorer permissions dialog). */
PermissionsController.get(
  "/item/:projectId/:resourceType/:resourceId",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await itemAclService.getItemAcl(
      req.params.projectId,
      req.params.resourceType,
      req.params.resourceId,
      req.userId
    );
    res.status(200).json({
      success: true,
      message: "OK",
      result,
    });
  })
);

PermissionsController.put(
  "/item/:projectId/:resourceType/:resourceId",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const result = await itemAclService.upsertItemAcl(
      req.params.projectId,
      req.params.resourceType,
      req.params.resourceId,
      req.userId,
      {
        defaultAccess: req.body.defaultAccess,
        inheritFromParent: req.body.inheritFromParent,
        explicitGrants: req.body.explicitGrants ?? [],
      }
    );
    res.status(200).json({
      success: true,
      message: "Permissions updated.",
      result,
    });
  })
);

export { PermissionsController };
