import express, { Request, Response } from "express";
import TagService from "../services/tag.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";

const TagController = express.Router();
const tagService = new TagService();

/**
 * GET /api/tags
 * Query Params: projectId
 * Desc: Get all tags for a specific project.
 */
TagController.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.query;

    if (!projectId) throw new AppError("Project ID is required", 400);

    const tags = await tagService.getAllTags(projectId as string);
    res.json(tags);
  })
);

/**
 * POST /api/tags
 * Body: { name, color, projectId }
 * Desc: Create a new tag for a project.
 */
TagController.post(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { name, color, projectId } = req.body;

    if (!name || !projectId) {
      throw new AppError("Missing required fields (name,  projectId)", 400);
    }

    const newTag = await tagService.createTag({ name, color, projectId });
    res.status(201).json(newTag);
  })
);

/**
 * PUT /api/tags/:id
 * Body: { name, color }
 * Desc: Update tag details (check duplicate name).
 */
TagController.put(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, color } = req.body; // Allow partial update

    // Ít nhất phải có 1 trường để update
    if (!name && !color) {
      throw new AppError("Nothing to update", 400);
    }

    const updatedTag = await tagService.updateTag(id, { name, color });
    res.json(updatedTag);
  })
);

/**
 * DELETE /api/tags/:id
 * Desc: Delete a tag.
 */
TagController.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!id) throw new AppError("Tag ID is required", 400);

    await tagService.deleteTag(id);
    res.json({ message: "Deleted successfully" });
  })
);

export { TagController };
