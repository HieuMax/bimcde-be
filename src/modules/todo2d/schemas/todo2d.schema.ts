import mongoose, { Schema } from "mongoose";
import { ITodo } from "../interfaces/todo2d.interface";

const Todo2DSchema = new Schema<ITodo>(
  {
    title: { type: String, required: true },
    description: { type: String },
    
    status: { 
      type: String, 
      enum: ["Open", "In Progress", "Done", "Closed"], 
      default: "Open" 
    },
    
    priority: { 
      type: String, 
      enum: ["Low", "Normal", "High", "Critical"], 
      default: "Normal" 
    },
    
    type: { 
      type: String, 
      enum: ["Comment", "Undefined", "Issue", "Request", "Fault", "Inquiry", "Solution", "Clash", "Remark"],
      default: "Issue"
    },
    dueDate: { type: Date },
    completion: { type: Number, default: 0 },
    assignee: { type: String }, // Backward compatibility: single assignee
    assignees: [{ type: String }], // NEW: Multiple assignees
    tags: [{ type: String }],
    
    // --- LIÊN KẾT ---
    projectId: { type: String, required: true }, 
    fileId: { type: String, required: true },
    /** Parent Topic (TopicItem); optional for legacy todos not under a topic */
    topicId: {
      type: Schema.Types.ObjectId,
      ref: "TopicItem",
      default: null,
      index: true,
    },
    viewId: { type: String }, // Link tới View (Optional)

    // --- VỊ TRÍ TRÊN BẢN VẼ (Quan trọng) ---
    position: {
      x: { type: Number },
      y: { type: Number },
      pageIndex: { type: Number }
    },
    
    // --- METADATA ---
    createdBy: { type: String },
    updatedBy: { type: String }, 
    userId: { type: Schema.Types.ObjectId, ref: "Account" },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model<ITodo>("Todo2D", Todo2DSchema);