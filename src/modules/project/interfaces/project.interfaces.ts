import { Types } from "mongoose";
import type { CdeWorkflowMode } from "../../../constants/cde-workflow";

export interface IProject {
  name: string;
  description?: string;
  workflowMode?: CdeWorkflowMode;
  cdeRootsInitialized?: boolean;
  createdBy: Object;
  thumbnail?: string;
  lastVisitedOn?: Date;
  size?: string;
  startDate?: Date;
  endDate?: Date;
  lastModifiedOn?: Date;
  modifiedBy?: Object;
  filesCount?: Number;
  folderCount?: Number;
  createdAt: Date;
  updatedAt: Date;
}
