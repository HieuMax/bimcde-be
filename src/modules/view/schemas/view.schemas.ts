import mongoose, { Schema } from "mongoose";
import { IView } from "../interfaces/view.interface";

const ViewSchema = new Schema<IView>(
    {
        title: { type: String, required: [true, "Title is required"] },
        description: { type: String },

        // Option A: Simple array of strings
        shareWith: [{ type: String }],
        tags: [{ type: String }],

        projectId: {
            type: Schema.Types.ObjectId,
            ref: "Project",
            required: [true, "Project ID is required"],
        },
        createdBy: {
            type: Schema.Types.ObjectId,
            ref: "Account",
            required: [true, "CreatedBy is required"],
        },

        // Context models
        items: [{
            fileUrl: { type: String },
            modelId: { type: String },
            expressId: [{ type: String }]
        }],

        // 3D State
        viewState: {
            type: Schema.Types.Mixed,
            default: null
        },
    },
    { timestamps: true }
);

const ViewModel = mongoose.model<IView>("View", ViewSchema);
export default ViewModel;