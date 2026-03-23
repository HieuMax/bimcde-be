import TopicModel from "../schemas/topic3d.schema";
import { ITopic } from "../interfaces/topic3d.interface";
import { AppError } from "../../../utils/AppError";
import { Types } from "mongoose";

export default class Topic3DService {
    async getTopics3DByProject(projectId: string, filters: any): Promise<ITopic[]> {
        const query: any = { projectId: new Types.ObjectId(projectId) };
        
        if (filters.status) query.status = filters.status;
        if (filters.search) {
            query.$or = [
                { title: { $regex: filters.search, $options: "i" } },
                { topicKey: { $regex: filters.search, $options: "i" } }
            ];
        }

        return await TopicModel.find(query)
            .sort({ createdAt: -1 }) // Lấy mới nhất lên đầu
            .populate("createdBy", "fullName email")
            .populate("updatedBy", "fullName email")
            .populate("references", "name currentVersion")
            .exec();
    }

    async createTopic3D(data: Partial<ITopic>): Promise<ITopic> {
        // Data truyền vào từ FE sẽ bao gồm cả viewState và items (nếu có)
        const newTopic = await TopicModel.create(data);
        return await newTopic.populate("createdBy", "fullName email");
    }

    async updateSnapshot(id: string, snapshotData: { viewState: any; items: any[]; thumbnailUrl?: string }): Promise<ITopic> {
        const topic = await TopicModel.findById(id);
        if (!topic) throw new AppError("Topic not found", 404);

        const updatedTopic = await TopicModel.findByIdAndUpdate(
            id,
            {
                viewState: snapshotData.viewState,
                items: snapshotData.items || [],
                ...(snapshotData.thumbnailUrl && { thumbnailUrl: snapshotData.thumbnailUrl })
            },
            { new: true }
        ).populate("createdBy", "fullName email");

        return updatedTopic as ITopic;
    }

    async updateTopic(id: string, updateData: any, userId:string): Promise<ITopic> {
        const topic = await TopicModel.findByIdAndUpdate(
            id,
            { $set: {...updateData, updatedBy: userId }},
            { new: true }
        )
        .populate("createdBy", "fullName email")
        .populate("updatedBy", "fullName email")
         .populate("references", "name currentVersion");

        if (!topic) throw new AppError("Topic not found", 404);
        return topic as ITopic;
    }

    async addSnapshot(id: string, snapshotData: { viewState: any; items: any[]; thumbnailUrl?: string}, userId: string ): Promise<ITopic> {
        const topic = await TopicModel.findById(id);
        if (!topic) throw new AppError("Topic not found", 404);

        const updatedTopic = await TopicModel.findByIdAndUpdate(
            id,
            {
                $set:{ updatedBy: userId},
                $push: { // Dùng $push để thêm vào danh sách thay vì thay thế
                    snapshots: {
                        viewState: snapshotData.viewState,
                        items: snapshotData.items || [],
                        thumbnailUrl: snapshotData.thumbnailUrl
                    }
                }
            },
            { new: true }
        )
        .populate("createdBy", "fullName email")
        .populate("updatedBy", "fullName email")
        .populate("references", "name currentVersion");
        return updatedTopic as ITopic;
    }

    async deleteTopic(id: string): Promise<boolean> {
        const topic = await TopicModel.findByIdAndDelete(id);
        if (!topic) throw new AppError("Topic not found", 404);
        return true;
    }
}