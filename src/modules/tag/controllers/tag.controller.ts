import { Request, Response, NextFunction } from "express";
import TagService from "../services/tag.service";
import { asyncHandler } from "../../../utils/asyncHandler";

const tagService = new TagService();

export class TagController {
  getAllTags = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      // Assuming projectId is passed via query or extracted from user context/params
      // For this MVP, let's assume it's passed as a query param or header, or fixed.
      // In a real app, it might come from req.user.currentProjectId
      const { projectId } = req.query;
      
      if (!projectId) {
          // Fallback or Error. Let's assume passed in query for now based on Explorer pattern
          return res.status(400).json({ message: "Project ID is required" });
      }

      const tags = await tagService.getAllTags(projectId as string);
      res.status(200).json(tags);
    }
  );

  createTag = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { name, color, projectId } = req.body;
      const tag = await tagService.createTag({ name, color, projectId });
      res.status(201).json(tag);
    }
  );

  updateTag = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params;
      const tag = await tagService.updateTag(id, req.body);
      res.status(200).json(tag);
    }
  );

  deleteTag = asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const { id } = req.params;
      await tagService.deleteTag(id);
      res.status(204).send();
    }
  );
}

export default new TagController();
