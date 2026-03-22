import { Types } from "mongoose";

interface IPriority {
  priorityId: Types.ObjectId;
  name: string;
  color: string;
}

interface IAssigness {
  assigneeId?: Types.ObjectId;
  name: string;
  type: string;
  label: string;
}

interface ITag {
  tagId: Types.ObjectId;
  name: string;
}

interface IType {
  typeId: Types.ObjectId;
  name: string;
}

interface ICreatdBy {
  fullName: string;
  userId: Types.ObjectId;
  email: string;
  role: string;
}

export interface ITodo {
  projectId: Types.ObjectId;
  name: string;
  description: string;
  priority: IPriority;
  assignees: IAssigness[];
  typeTopic: IType | null;
  tag: ITag[];
  dueDate: Date;
  createOn: Date;
  modifiedOn: Date;
  status: string;
  completion: number;
  createdBy: ICreatdBy;
  modifiedBy: ICreatdBy;
}
