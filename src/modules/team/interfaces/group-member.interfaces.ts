import { Types } from "mongoose";
import type { GroupMemberRole } from "../../../constants/cde-workflow";

export interface IGroupMember {
  groupId?: Types.ObjectId;
  userId: Types.ObjectId;
  role: GroupMemberRole;
  invitedAt?: Date;
  lastAccessed?: Date;
}
