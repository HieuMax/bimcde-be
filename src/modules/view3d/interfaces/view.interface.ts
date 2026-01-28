import mongoose, { Document } from "mongoose";

export interface IView extends Document {
    title: string;
    description?: string;
    projectId: mongoose.Types.ObjectId;
    createdBy: mongoose.Types.ObjectId;
    shareWith?: string[];
    tags?: string[];

    // Context Model
    items?: {
        fileUrl: string;
        modelId: string;
        expressId: string[];
    }[];

    // 3D State
    viewState?: {
        camera: {
            position: number[];
            target: number[];
        };
        visibility: {
            fileUrl: string;
            ids: number[];   // list hidden IDs
        }[];
        selection: {
            modelID: string | number;
            expressID: number;
            fileUrl?: string;
        }[];
        thumbnail?: string; // Base64 string
        modelOpacity?: number;
    };

    createdAt: Date;
    updatedAt: Date;
}