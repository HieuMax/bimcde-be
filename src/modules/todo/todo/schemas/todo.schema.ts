// import { Schema, model } from "mongoose";
// import { ITodo } from "../interfaces/todo.inferfaces";

// const todoSchema = new Schema<ITodo>(
//   {
//     projectId: {
//       type: Schema.Types.ObjectId,
//       ref: "projects",
//       required: true,
//     },
//     name: {
//       type: String,
//       required: true,
//     },
//     description: {
//       type: String,
//       default: "",
//     },
//     priority: {
//       type: {
//         priorityId: String,
//         name: String,
//         color: String,
//       },
//       default: null,
//     },
//     assignees: {
//       type: [
//         {
//           assigneeId: { type: String, required: true },
//           name: { type: String, required: true },
//           type: { type: String, required: true },
//           label: { type: String, required: true },
//         },
//       ],
//       default: [],
//     },
//     tag: {
//       type: [
//         {
//           tagId: String,
//           name: String,
//         },
//       ],
//       default: [],
//     },
//     typeTopic: {
//       type: {
//         typeId: String,
//         name: String,
//       },
//       default: null,
//     },
//     dueDate: {
//       type: Date,
//       default: null,
//     },
//     createOn: {
//       type: Date,
//       default: new Date(),
//     },
//     modifiedOn: {
//       type: Date,
//       default: new Date(),
//     },
//     completion: {
//       type: Number,
//       default: 0,
//     },
//     status: {
//       type: String,
//       default: "new",
//     },
//     createdBy: {
//       type: {
//         fullName: String,
//         userId: String,
//         email: String,
//         role: String,
//       },
//       default: null,
//     },
//     modifiedBy: {
//       type: {
//         fullName: String,
//         userId: String,
//         email: String,
//         role: String,
//       },
//       default: null,
//     },
//   },

//   {
//     timestamps: true,
//   },
// );

// const todoModel = model<ITodo>("Todo", todoSchema);

// export default todoModel;

import mongoose, { Schema } from "mongoose";
import { ITodo } from "../interfaces/todo.inferfaces";

const AttachmentSchema = new Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String },
    size: { type: Number },
    fileId: { type: String }, // Optional
  },
  { _id: false },
);

const TodoSchema = new Schema<ITodo>(
  {
    title: { type: String, required: [true, "Title is required"] },
    description: { type: String },
    status: {
      type: String,
      // enum: ["new", "in_progress", "done", "closed"],
      // default: "new",
      required: true,
    },
    priority: {
      priorityId: {
        type: Schema.Types.ObjectId,
        ref: "TopicPriority",
      },
      name: {
        type: String,
      },
      color: {
        type: String,
      },
    },

    completion: {
      type: Number,
      min: 0,
      max: 100,
      default: 0,
      required: true,
    },

    type: {
      typeId: {
        type: Schema.Types.ObjectId,
        ref: "TopicType",
      },
      name: {
        type: String,
      },
    },
    dueDate: { type: Date },
    items: [
      {
        fileUrl: { type: String },
        modelId: { type: String },
        expressId: [{ type: String }],
      },
    ],
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
      default: null,
    },
    attachments: [AttachmentSchema],
    assignees: [
      {
        assigneeId: { type: String, required: true },
        name: { type: String, required: true },
        type: { type: String, required: true },
        label: { type: String, required: true },
      },
    ],
    tags: [
      {
        tagId: String,
        name: String,
      },
    ],

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
  { timestamps: true },
);

TodoSchema.pre("save", function (next) {
  if (this.isModified("viewState")) {
    this.markModified("viewState");
  }
  next();
});

TodoSchema.index({ projectId: 1, status: 1, createdAt: -1 });
TodoSchema.index({ createdBy: 1 });
TodoSchema.index({ assignees: 1 });

const TodoModel = mongoose.model<ITodo>("Todo", TodoSchema);
export default TodoModel;
