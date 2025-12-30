import { model, Schema, Types } from "mongoose";
import { ITopics } from "../interfaces/topics.interface";

const TopicSchema = () => {
  return new Schema<ITopics>({
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Projects",
    },
    name: {
      type: String,
      required: true,
    },
    icon: {
      type: String,
      default: "",
    },
    color: {
      type: String,
      default: "",
    },
    visible: {
      type: Boolean,
      default: false,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
  });
};

const TopicType = model<ITopics>("TopicType", TopicSchema());
const TopicStatus = model<ITopics>("TopicStatus", TopicSchema());
const TopicPriority = model<ITopics>("TopicPriority", TopicSchema());

export { TopicType, TopicStatus, TopicPriority };
