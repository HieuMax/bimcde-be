import { Document, Types } from "mongoose";

export interface IActivity extends Document {
  projectId: Types.ObjectId;

  actor: {
    userId: Types.ObjectId;
    fullName: string;
    email?: string;
  };

  actionGroup:
    | "FILE"
    | "FOLDER"
    | "MEMBER"
    | "VIEW"
    | "RELEASE"
    | "TOPIC"
    | "TAG"
    | "PROJECT"
    | "PERMISSION"
    | "TODO"
    | "GROUP"
    | "COMMENT"
    | "RESTORE"
    | "CLASH";
  actionType: string; // "CREATE", "UPDATE", "DELETE", "UPLOAD", ...

  target: {
    itemId: Types.ObjectId;
    itemModel:
      | "File"
      | "Folder"
      | "View"
      | "Release"
      | "Topic"
      | "Account"
      | "Tag"
      | "Project"
      | "Group"
      | "Todo"
      | "Comment"
      | "ClashSet";
    itemName: string;
  };

  description?: string;
  metaData?: any; // Chứa thông tin thay đổi (from/to)

  createdAt: Date;
}

// Interface dùng cho input tạo log (DTO)
export interface CreateActivityDTO {
  projectId: string | Types.ObjectId;
  actor: {
    userId: string | Types.ObjectId;
    fullName: string;
    email?: string;
  };
  actionGroup:
    | "FILE"
    | "FOLDER"
    | "MEMBER"
    | "VIEW"
    | "RELEASE"
    | "TOPIC"
    | "TAG"
    | "PROJECT"
    | "PERMISSION"
    | "TODO"
    | "GROUP"
    | "COMMENT"
    | "RESTORE"
    | "CLASH";
  actionType: string;
  target: {
    itemId: string | Types.ObjectId;
    itemModel:
      | "File"
      | "Folder"
      | "View"
      | "Release"
      | "Topic"
      | "Account"
      | "Tag"
      | "Project"
      | "Group"
      | "Todo"
      | "Comment"
      | "ClashSet";
    itemName: string;
  };
  description?: string;
  metaData?: any;
}
