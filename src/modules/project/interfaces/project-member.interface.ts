import { Types } from "mongoose";

export interface IProjectMember {
  projectId?: Types.ObjectId;
  userId: Types.ObjectId;
  role?: string;
  invitedAt?: Date;
  lastAccessed?: Date;
}
