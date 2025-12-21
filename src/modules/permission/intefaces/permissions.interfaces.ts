import { Types } from "mongoose";

export interface IPermissions {
  projectId: Types.ObjectId;
  isTodosRestricted: boolean;
  isProjectInviteRestricted: boolean;
}
