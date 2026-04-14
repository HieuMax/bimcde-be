import { Types } from "mongoose";
import FolderModel from "../schemas/folder.schema";
import projectSchema from "../../project/schemas/project.schema";
import FolderService from "./folder.service";
import type { CdeWorkflowMode } from "../../../constants/cde-workflow";
import { CDE_ROOT_FOLDER_DEFINITIONS } from "../../../constants/cde-workflow";

const folderService = new FolderService();

/**
 * Creates the four standard CDE roots if missing and sets project.cdeRootsInitialized.
 * Safe to call multiple times (idempotent).
 */
export async function ensureCdeRootsInitialized(
  projectId: string,
  userId: Types.ObjectId,
  workflowMode: CdeWorkflowMode
): Promise<void> {
  const proj = await projectSchema.findById(projectId).lean();
  if (!proj) return;

  if (proj.cdeRootsInitialized) return;

  const existingRoots = await FolderModel.countDocuments({
    projectId: new Types.ObjectId(projectId),
    parentId: null,
    isCdeRoot: true,
    isDeleted: false,
  });

  if (existingRoots >= 4) {
    await projectSchema.updateOne(
      { _id: projectId },
      { $set: { cdeRootsInitialized: true } }
    );
    return;
  }

  const lockRoots = workflowMode === "ISO_19650";
  const pid = new Types.ObjectId(projectId);

  for (const def of CDE_ROOT_FOLDER_DEFINITIONS) {
    const already = await FolderModel.findOne({
      projectId: pid,
      parentId: null,
      cdeStage: def.cdeStage,
      isCdeRoot: true,
      isDeleted: false,
    }).lean();

    if (already) continue;

    await folderService.createFolder(
      {
        name: def.name,
        projectId: pid,
        parentId: null,
        createdBy: userId,
        cdeStage: def.cdeStage,
        isCdeRoot: true,
        isCdeRootLocked: lockRoots,
      },
      { allowIsoRootCreation: true }
    );
  }

  await projectSchema.updateOne(
    { _id: projectId },
    { $set: { cdeRootsInitialized: true } }
  );
}
