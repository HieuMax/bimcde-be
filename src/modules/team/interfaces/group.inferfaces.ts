import { Types } from "mongoose";

export interface IGroup {
  projectId: Types.ObjectId;
  name: string;
}
