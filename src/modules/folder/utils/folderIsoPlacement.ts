import { Types } from "mongoose";
import FolderModel from "../schemas/folder.schema";
import projectSchema from "../../project/schemas/project.schema";
import {
  parseCdeWorkflowMode,
  type CdeFolderStage,
} from "../../../constants/cde-workflow";
import { AppError } from "../../../utils/AppError";

/**
 * ISO: direct child of WIP/Shared CDE root with groupId (team “home” folder).
 */
export async function isIsoGroupHomeFolder(folder: {
  parentId?: Types.ObjectId | null;
  groupId?: Types.ObjectId | null;
}): Promise<boolean> {
  if (!folder.groupId || !folder.parentId) return false;
  const parent = await FolderModel.findOne({
    _id: folder.parentId,
    isDeleted: false,
  })
    .select("isCdeRoot cdeStage")
    .lean();
  return !!(
    parent &&
    parent.isCdeRoot &&
    (parent.cdeStage === "WIP" || parent.cdeStage === "SHARED")
  );
}

type IsoParentLean = {
  _id?: Types.ObjectId;
  isCdeRoot?: boolean;
  cdeStage?: CdeFolderStage | string;
  groupId?: Types.ObjectId | null;
  parentId?: Types.ObjectId | null;
} | null;

function isWipOrSharedCdeRoot(parent: NonNullable<IsoParentLean>): boolean {
  return (
    !!parent.isCdeRoot &&
    (parent.cdeStage === "WIP" || parent.cdeStage === "SHARED")
  );
}

/**
 * ISO 19650: do not create folders/files at project root (no parent) or with
 * 1. WIP / 2. Shared CDE roots as parent. Published/Archived roots are not restricted here.
 * @param options.allowStructural — createGroup sync (team folders under WIP/Shared roots)
 */
export async function assertIsoAllowsUserContentInParent(
  projectId: string,
  parentFolder: IsoParentLean,
  options?: { allowStructural?: boolean }
): Promise<void> {
  if (options?.allowStructural) return;

  const proj = await projectSchema
    .findById(projectId)
    .select("workflowMode")
    .lean();
  if (parseCdeWorkflowMode(proj?.workflowMode) !== "ISO_19650") return;

  if (!parentFolder) {
    throw new AppError(
      "In ISO 19650 mode, you cannot add folders or files at project root. Open a CDE stage folder first.",
      403
    );
  }

  if (isWipOrSharedCdeRoot(parentFolder)) {
    throw new AppError(
      "In ISO 19650 mode, you cannot add folders or files directly under 1. WIP or 2. Shared. Open a team folder first.",
      403
    );
  }
}
