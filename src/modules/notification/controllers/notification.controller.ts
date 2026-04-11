import express, { Request, Response } from "express";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import NotificationService from "../services/notification.services";
import { getIO } from "../../../lib/socket.lib";

const NotificationController = express.Router();
const notificationService = new NotificationService();

NotificationController.get(
  "/:userId",
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    if (!userId) throw new AppError("User ID is required", 400);

    const data = await notificationService.getAllNotification(userId);
    res.json(data);
  }),
);

NotificationController.post(
  "/create",
  asyncHandler(async (req: Request, res: Response) => {
    const data = req.body;

    if (!data) {
      throw new AppError("Invalid notification", 400);
    }

    const newNotification = await notificationService.createNotification(data);

    res.status(201).json(newNotification);
  }),
);

NotificationController.delete(
  "/delete/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) throw new AppError("Notification ID is required", 400);

    const updated = await notificationService.deleteNotification(id);

    if (!updated) {
      throw new AppError("Notification not found", 404);
    }


    res.json(updated);
  }),
);

NotificationController.put(
  "/deleteAll/:userId",
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    if (!userId) throw new AppError("User ID is required", 400);

    const data = await notificationService.deleteAllNotifications(userId);
    const io = getIO();
    io.to(`user_${userId}`).emit("deleteAll_notification", userId);

    res.json(data);
  }),
);

NotificationController.put(
  "/read/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) throw new AppError("Notification ID is required", 400);

    const data = await notificationService.readNotification(id);

    res.json(data);
  }),
);

NotificationController.put(
  "/readAll/:userId",
  asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;

    if (!userId) throw new AppError("User ID is required", 400);

    const data = await notificationService.readAllNotifications(userId);

    const io = getIO();

    io.to(`user_${userId}`).emit("read_notification", userId);
    res.json(data);
  }),
);

export { NotificationController };
