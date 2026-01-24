import mongoose, { Schema } from "mongoose";
import { ITodo } from "../interfaces/todo.interface";

const TodoSchema = new Schema<ITodo>(
  {
    title: { type: String, required: [true, "Title is required"] },
    description: { type: String },
    status: {
      type: String,
      enum: ["New", "In Progress", "Done", "Closed"],
      default: "New",
      required: true,
    },
    priority: {
      type: String,
      enum: ["high", "normal", "low"],
      default: "normal",
      required: true,
    },
    completion: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      required: true,
    },
    assignees: [{ type: String }],
    type: {
      type: String,
      enum: [
        "undefined",
        "comment",
        "issue",
        "request",
        "fault",
        "inquiry",
        "solution",
        "remark",
        "clash",
      ],
      default: "undefined",
      required: true,
    },
    tags: [{ type: String }],
    dueDate: { type: Date },
    items: [{
      fileUrl: { type: String },
      modelId: { type: String },
      expressId: [{ type: String }]
    }],
    // viewState: {
    //   camera: {
    //     position: [{ type: Number }],
    //     target: [{ type: Number }]   
    //   },
    //   visibility: [{
    //     modelID: { type: Schema.Types.Mixed },
    //     ids: [{ type: Number }]
    //   }],
    //   selection: [{
    //     modelID: { type: Schema.Types.Mixed },
    //     expressID: { type: Number },
    //     fileUrl: { type: String }
    //   }],
    //   thumbnail: { type: String }
    // },
    viewState: {
      type: Schema.Types.Mixed,
      default: null
    },
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
  },
  { timestamps: true }
);

TodoSchema.pre('save', function (next) {
  if (this.isModified('viewState')) {
    this.markModified('viewState');
  }
  next();
});

TodoSchema.index({ projectId: 1, status: 1, createdAt: -1 });
TodoSchema.index({ createdBy: 1 });
TodoSchema.index({ assignees: 1 });

const TodoModel = mongoose.model<ITodo>("Todo", TodoSchema);
export default TodoModel;
