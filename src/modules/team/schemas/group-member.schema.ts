import { Types, model, Schema } from "mongoose";
import { IGroupMember } from "../interfaces/group-member.interfaces"; // Ensure correct interface import

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
    invitedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, 
  }
);

// Define the model with a unique name "GroupMember" to avoid conflict
const groupMemberModel = model<IGroupMember>("GroupMember", groupMemberSchema);

export default groupMemberModel;
