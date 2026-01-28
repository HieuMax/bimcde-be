import { Types } from "mongoose";

export interface IGroupMember {
  groupId?: Types.ObjectId;
  userId: Types.ObjectId;
  role?: string;
  invitedAt?: Date;
  lastAccessed?: Date;
}
