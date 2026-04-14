import mongoose, { Schema } from "mongoose";
import { ITopicItem } from "../interfaces/topic-item.interface";

const TopicStatsSchema = new Schema(
  {
    comments: { type: Number, default: 0 },
    viewpoints: { type: Number, default: 0 },
    attachments: { type: Number, default: 0 },
  },
  { _id: false },
);

const AttachmentSchema = new Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    mimeType: { type: String },
    size: { type: Number },
    fileId: { type: String },
  },
  { _id: false },
);

const TopicItemSchema = new Schema<ITopicItem>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Projects",
      required: true,
      index: true,
    },
    code: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    assignee: { type: String, default: "" },

    type: {
      type: String,
      enum: [
        "Undefined",
        "Comment",
        "Issue",
        "Request",
        "Fault",
        "Inquiry",
        "Solution",
        "Remark",
        "Clash",
      ],
      required: true,
    },
    /** Canonical workflow — see constants/topic-todo-workflow.ts */
    status: {
      type: String,
      enum: [
        "New",
        "In Progress",
        "Waiting",
        "Done",
        "Resolved",
        "Closed",
      ],
      required: true,
      default: "New",
    },
    priority: {
      type: String,
      enum: ["Low", "Normal", "High", "Critical"],
      required: true,
      default: "Normal",
    },

    tags: [{ type: String, default: [] }],
    dueDate: { type: Date, default: null },
    authorName: { type: String, required: true },
    thumbnailUrl: { type: String, default: "" },

    stats: { type: TopicStatsSchema, default: {} },

    attachments: { type: [AttachmentSchema], default: [] },

    /** Primary file this topic is about (ISO gate + notifications); optional for legacy rows */
    fileId: {
      type: Schema.Types.ObjectId,
      ref: "File",
      default: null,
      index: true,
    },
    /** Optional: which file version the issue referred to */
    linkedFileVersion: { type: Number, default: null },
    /** Topic creator — for notifications when file version changes */
    authorUserId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },

    /** 3D viewer: saved camera/context (same collection as dashboard topics). */
    viewState: { type: Schema.Types.Mixed, default: null },
    items: [
      {
        fileUrl: { type: String },
        modelId: { type: String },
        expressId: [{ type: String }],
      },
    ],
    snapshots: [
      {
        thumbnailUrl: { type: String },
        viewState: { type: Schema.Types.Mixed },
        items: [{ type: Schema.Types.Mixed }],
      },
    ],
    /** File references (ObjectIds) — explorer-linked files; separate from URL attachments. */
    references: [
      {
        type: Schema.Types.ObjectId,
        ref: "File",
      },
    ],
  },
  { timestamps: true },
);

TopicItemSchema.pre("save", function (next) {
  if (this.isModified("viewState")) {
    this.markModified("viewState");
  }
  next();
});

TopicItemSchema.index({ projectId: 1, updatedAt: -1 });
TopicItemSchema.index({ projectId: 1, fileId: 1 }, { sparse: true });

const TopicItemModel = mongoose.model<ITopicItem>("TopicItem", TopicItemSchema);
export default TopicItemModel;
