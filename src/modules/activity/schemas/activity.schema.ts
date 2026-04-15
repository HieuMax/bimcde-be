import mongoose, { Schema } from "mongoose";
// Interface sẽ được define trong folder interfaces tương ứng
// import { IActivity } from "../interfaces/activity.interface";

const ActivitySchema = new Schema(
  {
    // 1. Context: Log này thuộc dự án nào?
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project", // Link với schema Project hiện tại
      required: true,
      index: true,
    },

    // 2. Actor: Ai thực hiện? (Link với AccountModel hiện tại)
    actor: {
      userId: { type: Schema.Types.ObjectId, ref: "Account", required: true },
      fullName: String, // Snapshot tên user để hiển thị nhanh
      email: String, // Snapshot email
    },

    // 3. Action Info
    actionGroup: {
      type: String,
      enum: [
        "FILE",
        "FOLDER",
        "MEMBER",
        "VIEW",
        "RELEASE",
        "TOPIC",
        "TAG",
        "PROJECT",
        "PERMISSION",
        "TODO",
        "GROUP",
        "COMMENT",
        "RESTORE",
        "CLASH",
      ],
      required: true,
    },
    actionType: {
      type: String,
      required: true, // VD: 'UPLOAD', 'RENAME', 'DELETE', 'LOGIN'
    },

    // 4. Target (Polymorphic Pattern): Đối tượng bị tác động
    target: {
      itemId: { type: Schema.Types.ObjectId, required: true },
      itemModel: {
        type: String,
        required: true,
        // Enum phải khớp với tên Model bạn đã export (File, Folder, ProjectMember...)
        enum: [
          "File",
          "Folder",
          "View",
          "Release",
          "Topic",
          "Account",
          "Tag",
          "Project",
          "Group",
          "Todo",
          "Comment",
          "ClashSet",
        ],
      },
      itemName: String, // Snapshot tên đối tượng (vì file có thể bị rename sau này)
    },

    // 5. Diff (Optional): Lưu thay đổi (cho hành động Rename/Move)
    description: { type: String }, // Mô tả chi tiết nếu cần
    metaData: { type: Schema.Types.Mixed }, // Chứa from/to hoặc thông tin bổ sung
  },
  { timestamps: { createdAt: true, updatedAt: false } } // Chỉ cần createdAt
);

// Indexing tối ưu cho tra cứu lịch sử
ActivitySchema.index({ projectId: 1, createdAt: -1 });
ActivitySchema.index({ projectId: 1, "actor.userId": 1, createdAt: -1 });

export default mongoose.model("Activity", ActivitySchema);
