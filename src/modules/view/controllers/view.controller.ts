import express, { Request, Response } from "express";
import ViewService from "../services/view.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";


const viewService = new ViewService();
const ViewController = express.Router();

ViewController.post(
  "/views/:fileId",
  asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params;
    const { userId, ...payload } = req.body;
    const view = await viewService.create({
      ...payload,
      fileId,
      createdBy: userId,
    });

    res.status(201).json({ success: true, data: view });
  })
);

ViewController.get(
  "/views/:fileId/file",
  asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params;
    const views = await viewService.getByFile(fileId);
    res.json({ success: true, data: views });
  })
);

ViewController.get(
  "/views/:viewId/detail",
  asyncHandler(async (req: Request, res: Response) => {
    const { viewId } = req.params;
    const view = await viewService.getById(viewId);
    res.json({ success: true, data: view });
  })
);

ViewController.delete(
  "/views/:viewId",
  asyncHandler(async (req: Request, res: Response) => {
    const { viewId } = req.params;
    const { userId } = req.body;
    await viewService.softDelete(viewId, userId);
    res.json({ success: true, message: "View deleted" });
  })
);

export { ViewController };
