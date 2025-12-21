import { Schema, model } from "mongoose";
import { IPermissions } from "../intefaces/permissions.interfaces";

const permissionsSchema = new Schema<IPermissions>({
  projectId: {
    type: Schema.Types.ObjectId,
    ref: "projects",
    required: true,
  },
  isTodosRestricted: {
    type: Boolean,
    default: false,
  },
  isProjectInviteRestricted: {
    type: Boolean,
    default: false,
  },
});

const permissionsModel = model<IPermissions>("permissions", permissionsSchema);

export default permissionsModel;


