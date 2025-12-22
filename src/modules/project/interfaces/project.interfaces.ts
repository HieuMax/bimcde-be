import { Types } from "mongoose";

export interface IProject {
  name: string;
  description?: string;
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
