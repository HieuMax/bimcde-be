import { Types } from "mongoose";

export interface ITopicData {
  topicTypes: ITopics[]; 
  topicStatuses: ITopics[]; 
  topicPriorities: ITopics[];
}

export interface ITopics {
  projectId: Types.ObjectId;
  icon: string;
  name: string;
  color: string;
  visible: boolean;
  isDefault: boolean;
}
