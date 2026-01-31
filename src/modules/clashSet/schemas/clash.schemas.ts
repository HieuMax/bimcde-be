import mongoose, { Schema } from "mongoose";
import { IClashSet } from "../interfaces/clash.interface";

const ClashItemSchema = new Schema({
    name: { type: String },
    distance: { type: String },
    status: { type: String, default: 'Active', enum: ['Active', 'Resolved', 'Ignored'] },
    image: { type: String },
    item1: { type: Object }, // { modelID, expressID }
    item2: { type: Object },
    point: { type: Object }  // { x, y, z }
}, { _id: true })

const ClashSetSchema = new Schema<IClashSet>(
    {
        name: { type: String, required: [true, "Clash set name is required"] },
        type: { type: String, default: "clash" },
        status: { type: String, default: "Active" },
        tolerance: { type: Number, default: 0.01 },
        ignoreSameType: { type: Boolean, default: false },

        projectId: {
            type: Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            required: true
        },

        models: [{
            modelId: { type: Schema.Types.Mixed },
            fileUrl: { type: String },
            version: { type: String },
            name: { type: String }
        }],

        items: [ClashItemSchema],

        clashCount: { type: Number, default: 0 }
    },
    { timestamps: true }
);

const ClashModel = mongoose.model<IClashSet>("ClashSet", ClashSetSchema);
export default ClashModel;