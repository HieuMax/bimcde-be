import { Schema, model } from "mongoose";
import { ITodo } from "../interfaces/todo.inferfaces";

const todoSchema = new Schema<ITodo>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "projects",
      required: true,
    },
    name: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: "",
    },
    priority: {
      type: {
        priorityId: String,
        name: String,
        color: String,
      },
      default: null,
    },
    assignees: {
      type: [
        {
          assigneeId: { type: String, required: true },
          name: { type: String, required: true },
          type: { type: String, required: true },
          label: { type: String, required: true },
        },
      ],
      default: [],
    },
    tag: {
      type: [
        {
          tagId: String,
          name: String,
        },
      ],
      default: [],
    },
    typeTopic: {
      type: {
        typeId: String,
        name: String,
      },
      default: null,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    createOn: {
      type: Date,
      default: new Date(),
    },
    modifiedOn: {
      type: Date,
      default: new Date(),
    },
    completion: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      default: "new",
    },
    createdBy: {
      type: {
        fullName: String,
        userId: String,
        email: String,
        role: String,
      },
      default: null,
    },
    modifiedBy: {
      type: {
        fullName: String,
        userId: String,
        email: String,
        role: String,
      },
      default: null,
    },
  },

  {
    timestamps: true,
  },
);

const todoModel = model<ITodo>("Todo", todoSchema);

export default todoModel;
