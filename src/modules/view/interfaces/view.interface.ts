import mongoose, { Document } from "mongoose";

export interface IView extends Document {
    title: string;
    description?: string;
    projectId: mongoose.Types.ObjectId;
    createdBy: mongoose.Types.ObjectId;
    shareWith?: string[]; // Option A: Mảng các email/tên
    tags?: string[];

    // Context Model (Để biết view này thuộc file nào)
    items?: {
        fileUrl: string;
        modelId: string;
        expressId: string[];
    }[];

    // Trạng thái 3D
    viewState?: {
        camera: {
            position: number[];
            target: number[];
        };
        visibility: {
            // modelID: string | number;
            // ids: number[];
            fileUrl: string; // Lưu URL thay vì modelID để không bị mất dấu
            ids: number[];   // Danh sách ID bị ẩn
        }[];
        selection: {
            modelID: string | number;
            expressID: number;
            fileUrl?: string;
        }[];
        thumbnail?: string; // Base64 string
    };

    createdAt: Date;
    updatedAt: Date;
}