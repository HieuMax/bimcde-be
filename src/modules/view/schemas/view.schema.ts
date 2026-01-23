import mongoose, { Schema } from "mongoose";
// import { IView } from "../interfaces/view.interface";

const ViewSchema = new Schema(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },

    // Thông tin cơ bản
    name: { type: String, required: true },
    description: String,
    thumbnailUrl: { type: String }, // URL ảnh snapshot từ S3/R2

    // Phân loại
    type: {
      type: String,
      enum: ["3D", "2D"],
      required: true,
    },

    // Nếu là 2D View thì bắt buộc phải gắn với 1 File bản vẽ cụ thể
    relatedFileId: {
      type: Schema.Types.ObjectId,
      ref: "File",
      required: function (this: any) {
        return this.type === "2D";
      },
    },

    // Quyền hạn & Chia sẻ
    createdBy: { type: Schema.Types.ObjectId, ref: "Account", required: true },

    sharedWith: {
      isPublic: { type: Boolean, default: false }, // Public trong Project
      users: [{ type: Schema.Types.ObjectId, ref: "Account" }], // Share riêng lẻ
      // Nếu sau này có module Group/Team thì thêm vào đây
    },

    // CORE: Dữ liệu trạng thái của View (JSON payload)
    viewState: {
      camera: {
        position: { x: Number, y: Number, z: Number },
        target: { x: Number, y: Number, z: Number },
        up: { x: Number, y: Number, z: Number },
        projection: { type: String, enum: ["ORTHO", "PERSPECTIVE"] },
        zoom: Number,
      },
      // Lưu mảng GlobalId (IFC GUID)
      hiddenElements: [String],
      selectedElements: [String],
      coloredElements: [
        {
          color: String,
          elementIds: [String],
        },
      ],
      sectionPlanes: [
        {
          position: { x: Number, y: Number, z: Number },
          normal: { x: Number, y: Number, z: Number },
        },
      ],
      // Dữ liệu markup (Redlines)
      markupData: { type: Schema.Types.Mixed },
    },
  },
  { timestamps: true }
);

ViewSchema.index({ projectId: 1, type: 1 });
ViewSchema.index({ projectId: 1, createdBy: 1 });

export default mongoose.model("View", ViewSchema);
