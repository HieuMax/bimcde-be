import express, { Request, Response } from "express";
import { cleanUpSoftDeletedItems } from "../services/cleanup.service";

const CleanupController = express.Router();

// DELETE /api/cleanup/force
CleanupController.delete("/force", async (req: Request, res: Response) => {
  try {
    // (0 retention -> Delete immediately)
    const result = await cleanUpSoftDeletedItems(0);

    res.status(200).json({
      message: "Force cleanup executed successfully",
      details: result,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export { CleanupController };
