import mongoose, { Document } from "mongoose";

export interface IClashItem {
    name: string;
    distance: string;
    status: "Active" | "Resolved" | "Ignored";
    image?: string;
    item1: {
        modelID: string | number;
        expressID: number | string;
    };
    item2: {
        modelID: string | number;
        expressID: number | string;
    };
    point?: { x: number; y: number; z: number };
}

export interface IClashSet extends Document {
    name: string;
    projectId: mongoose.Types.ObjectId;
    createdBy: mongoose.Types.ObjectId;

    type: "clash" | "clearance";
    status: "Active" | "Resolved" | "Processing";
    tolerance: number;
    ignoreSameType: boolean;

    models: {
        modelId: string | number;
        fileUrl?: string;
        version?: string;
        name?: string;
    }[];

    items: IClashItem[];
    clashCount: number;

    createdAt: Date;
    updatedAt: Date;
}