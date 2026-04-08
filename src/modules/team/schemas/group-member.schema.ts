import { Types, model, Schema } from "mongoose";
import { IGroupMember } from "../interfaces/group-member.interfaces";
import { GROUP_MEMBER_ROLES } from "../../../constants/cde-workflow";

const groupMemberSchema = new Schema<IGroupMember>(
  {
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      required: true,
    },
    /** ISO CDE: leader vs member within this group */
    role: {
      type: String,
      enum: GROUP_MEMBER_ROLES,
      default: "GROUP_MEMBER",
    },
    invitedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

groupMemberSchema.index({ groupId: 1, userId: 1 }, { unique: true });

const groupMemberModel = model<IGroupMember>("GroupMember", groupMemberSchema);

export default groupMemberModel;
