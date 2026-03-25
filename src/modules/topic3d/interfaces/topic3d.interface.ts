import mongoose, { Document } from "mongoose";

export type TopicPriority = "Low" | "Normal" | "High" | "Critical";
export type TopicStatus = "New" | "In Progress" | "Waiting" | "Done" | "Closed";
export type TopicType = "Undefined" | "Comment" | "Issue" | "Request" | "Fault" | "Inquiry" | "Solution" | "Remark" | "Clash" | "Opo";

export interface ITopic extends Document {
    topicKey: string; 
    title: string;
    description?: string;
    projectId: mongoose.Types.ObjectId;
    
    priority: TopicPriority;
    status: TopicStatus;
    type: TopicType;
    
    assignee?: mongoose.Types.ObjectId;
    dueDate?: Date;
    tags?: string[];
    thumbnailUrl?: string; // Ảnh snapshot (Base64 hoặc URL)
    createdBy: mongoose.Types.ObjectId;
    updatedBy?: mongoose.Types.ObjectId;
    // --- 3D Context (Kế thừa logic từ View3D) ---
    items?: {
        fileUrl: string;
        modelId: string;
        expressId: string[];
    }[];

    snapshots?:{
        thumbnailUrl?: string; // Ảnh snapshot (Base64 hoặc URL)
        viewState: any; // Có thể định nghĩa chi tiết giống View3D nếu cần
        items: any[]
    }[]; 

    viewState?: any; // Có thể định nghĩa chi tiết giống View3D nếu cần

    createdAt: Date;
    updatedAt: Date;
    references?: mongoose.Types.ObjectId[]; // Tham chiếu đến File hoặc Model khác nếu cần
}