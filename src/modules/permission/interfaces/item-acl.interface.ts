import { Types } from "mongoose";

export type ItemResourceType = "folder" | "file";

export type ItemAccessLevel = "FULL" | "READ_ONLY" | "NO_ACCESS";

export type GrantSubjectType = "USER" | "GROUP";

export interface IItemAclGrant {
  subjectType: GrantSubjectType;
  subjectId: Types.ObjectId;
  access: ItemAccessLevel;
}

export interface IItemAcl {
  projectId: Types.ObjectId;
  resourceType: ItemResourceType;
  resourceId: Types.ObjectId;
  defaultAccess: ItemAccessLevel;
  /** Only used when resourceType === "folder". */
  inheritFromParent: boolean;
  grants: IItemAclGrant[];
}
