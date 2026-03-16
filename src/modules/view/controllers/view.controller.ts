import express, { Request, Response } from "express";
import ViewService from "../services/view.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import { auditLog } from "../../../middlewares/auditLog.middleware"; // Import Middleware
import { authenticate } from "../../../middlewares/authMiddlewares";

const ViewController = express.Router();
const viewService = new ViewService();

// GET /api/views?projectId=...&type=3D&createdBy=...
ViewController.get(
  "/",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, type, createdBy } = req.query;
    const user = (req as any).user || (req as any).account; // Lấy user từ token
    console.log(user);
    if (!projectId) throw new AppError("Project ID is required", 400);

    const views = await viewService.getViews(projectId as string, user, {
      type: type as string,
      createdBy: createdBy as string,
    });
    res.json(views);
  }),
);

// GET /api/views/:id (Load chi tiết view vào Viewer)
ViewController.get(
  "/:id",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user || (req as any).account;

    const view = await viewService.getViewById(id, user._id.toString());
    res.json(view);
  }),
);

// POST /api/views (Create View)
ViewController.post(
  "/",
  authenticate,
  // --- AUTO LOGGING ---
  auditLog("VIEW", "CREATE", (req, resBody) => ({
    itemId: resBody._id,
    itemName: resBody.name,
    itemModel: "View",
  })),
  // --------------------
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user || (req as any).account;
    const { projectId, name, type } = req.body;

    if (!projectId || !name || !type) {
      throw new AppError(
        "Missing required fields (projectId, name, type)",
        400,
      );
    }

    const newView = await viewService.createView(req.body, user._id.toString());
    res.status(201).json(newView);
  }),
);

// PUT /api/views/:id (Update View State/Rename)
ViewController.put(
  "/:id",
  authenticate,
  // --- AUTO LOGGING ---
  auditLog("VIEW", "UPDATE", (req, resBody) => ({
    itemId: resBody._id,
    itemName: resBody.name,
    itemModel: "View",
  })),
  // --------------------
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user || (req as any).account;

    const updatedView = await viewService.updateView(
      id,
      req.body,
      user._id.toString(),
    );
    res.json(updatedView);
  }),
);

// DELETE /api/views/:id
ViewController.delete(
  "/:id",
  authenticate,
  // --- AUTO LOGGING ---
  auditLog("VIEW", "DELETE", (req, resBody) => ({
    itemId: req.params.id, // Với Delete, lấy ID từ params vì resBody có thể rỗng hoặc chỉ là message
    itemName: "View Deleted", // Delete thường không trả về tên, ta có thể query trước nếu muốn chính xác, hoặc để generic
    itemModel: "View",
  })),
  // --------------------
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = (req as any).user || (req as any).account;

    const deletedView = await viewService.deleteView(id, user._id.toString());
    res.json({
      message: "View deleted successfully",
      projectId: deletedView.projectId,
    });
  }),
);

export { ViewController };
