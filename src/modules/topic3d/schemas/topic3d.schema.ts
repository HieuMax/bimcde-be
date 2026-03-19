import mongoose, { Schema } from "mongoose";
import { ITopic } from "../interfaces/topic3d.interface";

const Topic3DSchema = new Schema<ITopic>(
    {
        topicKey: { type: String, unique: true },
        title: { type: String, required: [true, "Title is required"] },
        description: { type: String },
        projectId: { type: Schema.Types.ObjectId, ref: "Project", required: true },
        
        priority: { type: String, default: "Normal" },
        status: { type: String, default: "New" },
        type: { type: String, default: "Issue" },
        
        assignee: { type: Schema.Types.ObjectId, ref: "Account" },
        dueDate: { type: Date },
        tags: [{ type: String }],
        thumbnailUrl: { type: String },
        
        createdBy: { type: Schema.Types.ObjectId, ref: "Account", required: true },
        updatedBy: { type: Schema.Types.ObjectId, ref: "Account" },
        snapshots: [{
            thumbnailUrl: { type: String },
            viewState: { type: Schema.Types.Mixed },
            items: [{ type: Schema.Types.Mixed }]
        }],

        // Context models & 3D State
        items: [{
            fileUrl: { type: String },
            modelId: { type: String },
            expressId: [{ type: String }]
        }],
        viewState: {
            type: Schema.Types.Mixed,
            default: null
        },
        references: [{
            type: Schema.Types.ObjectId,
            ref: "File"
        }]
        
    },
    { timestamps: true },
    
);

// Tự động sinh topicKey trước khi lưu
Topic3DSchema.pre("save", async function (next) {
    if (this.isNew) {
        const count = await mongoose.model("Topic3D").countDocuments({ projectId: this.projectId });
        // Có thể thay "TOPIC" bằng Prefix của Project nếu bạn có lưu Prefix trong Project Model
        this.topicKey = `TOPIC-${count + 1}`; 
    }
    next();
});

const TopicModel = mongoose.model<ITopic>("Topic3D", Topic3DSchema);
export default TopicModel;