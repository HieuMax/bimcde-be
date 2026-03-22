import { Types, model, Schema } from "mongoose";
import { IProjectMember } from "../interfaces/project-member.interface"; 

const projectMemberSchema = new Schema<IProjectMember>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    invitedAt: {
      type: Date,
      default: Date.now,
    },
    lastAccessed: {
      type: Date,
      default: Date.now,
    },
    role: {
      type: String,
      enum: ["user", "admin"],
      default: "USER",
    },
  },
  {
    timestamps: true,
  }
);

export default model<IProjectMember>("ProjectMember", projectMemberSchema);
