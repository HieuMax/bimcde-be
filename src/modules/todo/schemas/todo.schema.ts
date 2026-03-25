import mongoose, { Schema } from "mongoose";
import { ITodo } from "../interfaces/todo.interface";

const TodoSchema = new Schema<ITodo>(
  {
    title: { type: String, required: true },
    description: { type: String },
    
    status: { 
      type: String, 
      enum: ["Open", "In Progress", "Done", "On Hold"], 
      default: "Open" 
    },
    
    priority: { 
      type: String, 
      enum: ["Low", "Normal", "High", "Urgent"], 
      default: "Normal" 
    },
    
    type: { type: String, default: "Issue" },
    dueDate: { type: Date },
    completion: { type: Number, default: 0 },
    assignee: { type: String },
    tags: [{ type: String }],
    
    // --- LIÊN KẾT ---
    projectId: { type: String, required: true }, 
    fileId: { type: String, required: true },
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

export default mongoose.model<ITodo>("Todo", TodoSchema);