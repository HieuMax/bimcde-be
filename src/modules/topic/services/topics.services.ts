import { Types } from "mongoose";
import {
  TopicType,
  TopicStatus,
  TopicPriority,
} from "../schemas/topics.schema";
import TopicItemModel from "../schemas/topic-item.schema";
import { ITopicData } from "../interfaces/topics.interface";
import projectMemberSchema from "../../project/schemas/project-member.schema";
import groupModel from "../../team/schemas/group.schema";
import groupMemberModel from "../../team/schemas/group-member.schema";
import { AppError } from "../../../utils/AppError";
import {
  assertTagsInputWithinLimits,
  assertValidTopicTitle,
  parseOptionalTopicDueDate,
  parseTopicPriority,
  parseTopicStatus,
  parseTopicType,
  sanitizeTopicAssignee,
  sanitizeTopicDescription,
  sanitizeTopicTags,
  sanitizeTopicTitle,
} from "../utils/topicItemInput.validation";
import {
  countNonTerminalTodosForTopic,
  isTopicResolutionStatus,
} from "../utils/topic-todo-collaboration.helpers";

const TOPIC_ATTACHMENTS_MAX = 50;

export default class TopicsService {
  private async getActorRole(
    projectId: string | Types.ObjectId,
    userId: Types.ObjectId | undefined
  ): Promise<"ADMIN" | "LEADER" | "MEMBER"> {
    if (!userId) throw new AppError("Unauthorized", 401);
    const member = await projectMemberSchema.findOne({ userId, projectId }).lean();
    if (!member) throw new AppError("Bạn không có quyền truy cập vào dự án này.", 403);
    if (String(member.role).toLowerCase() === "admin") return "ADMIN";

    const groups = await groupModel.find({ projectId }).select("_id").lean();
    const groupIds = groups.map((g) => g._id);
    const gm = await groupMemberModel
      .findOne({ userId, groupId: { $in: groupIds }, role: "GROUP_LEADER" })
      .lean();
    return gm ? "LEADER" : "MEMBER";
  }

  // Cập nhật Topic cho dự án
  async updateTopic(
    userId: Types.ObjectId | undefined,
    projectId: string,
    updateData: ITopicData,
  ) {
    try {
      // Kiểm tra người dùng có phải là thành viên của dự án không
      const member = await projectMemberSchema.findOne({
        userId: userId,
        projectId: projectId,
      });
      if (!member) {
        throw new Error("Bạn không có quyền truy cập vào dự án này.");
      }
      if (String(member.role).toLowerCase() !== "admin") {
        throw new AppError("Only Admin can update topic settings.", 403);
      }

      const { topicTypes, topicStatuses, topicPriorities } = updateData;

      // Chèn thêm projectId vào từng item trong mảng để quản lý
      const addProjectId = (arr: any[]) =>
        arr.map((item) => ({ ...item, projectId }));

      // Thực hiện: Xóa hết cái cũ của Project -> Chèn cái mới vào
      await Promise.all([
        // Xử lý TopicType
        TopicType.deleteMany({ projectId }).then(() =>
          TopicType.insertMany(addProjectId(topicTypes)),
        ),
        // Xử lý Status
        TopicStatus.deleteMany({ projectId }).then(() =>
          TopicStatus.insertMany(addProjectId(topicStatuses)),
        ),
        // Xử lý Priority
        TopicPriority.deleteMany({ projectId }).then(() =>
          TopicPriority.insertMany(addProjectId(topicPriorities)),
        ),
      ]);

      return {
        success: true,
        message: "Đã cập nhật toàn bộ cài đặt thành công!",
      };
    } catch (error: any) {
      throw new Error(`Lỗi cập nhật: ${error.message}`);
    }
  }

  // Lấy tất cả Topics của dự án
  async getAllTopics(userId: Types.ObjectId | undefined, projectId: string) {
    try {
      // Kiểm tra người dùng có phải là thành viên của dự án không
      const member = await projectMemberSchema.findOne({
        userId: userId,
        projectId: projectId,
      });
      if (!member) {
        throw new Error("Bạn không có quyền truy cập vào dự án này.");
      }

      const topicTypes = await TopicType.find({ projectId }).lean();
      const topicStatuses = await TopicStatus.find({ projectId }).lean();
      const topicPriorities = await TopicPriority.find({ projectId }).lean();

      const result = { topicTypes, topicStatuses, topicPriorities };
      return result;
    } catch (error) {
      throw error;
    }
  }

  // Tạo các topic mặc định cho một dự án mới
  async createTopicDefault(projectId: Types.ObjectId) {
    try {
      const defaultTopicTypes = [
        {
          name: "Undefined",
          color: "#363545",
          icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjUiIHZpZXdCb3g9IjAgMCAyNCAyNSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xMy4yMDY2IDcuMjM1MTdDMTMuODU0NyA4LjA2NjE0IDE0LjY5NDcgOS4zOTUzNCAxNS4xNjAyIDExLjE2QzE1LjY0MDIgMTIuOTc1NiAxNS41NzY1IDE0LjQzMTIgMTUuNDMwMiAxNS4zODY3QzE1LjYzNzQgMTUuMzQ0OSAxNS44MTAyIDE1LjMwMjIgMTUuOTQ0NyAxNS4yNjY3QzE2LjMzMiAxNS4xNjMxIDE2LjY2NTYgMTQuOTc0IDE2LjkzNDcgMTQuNzA0OEMxNy4xODI5IDE0LjQ1NTcgMTcuMzY4MyAxNC4xNTEyIDE3LjUwNDcgMTMuODE4NEMxNy4zMDkyIDEyLjU4OTIgMTcuMDE1NiAxMS4zOTM3IDE2LjgzMiAxMC42OTgyQzE2LjY0NTYgOS45OTA4NCAxNi4zMDI5IDguNzg0MzggMTUuODUxMSA3LjU5NjExQzE1LjY4OTIgNy4xNjk3MSAxNS41MTI5IDYuNzQ1MTMgMTUuMzI0NyA2LjM0NjkyQzE0Ljk4NDcgNS42MjY4NiAxNC42MDY1IDQuOTk0MDggMTQuMjAzOCA0LjU5MDQyTDE0LjA5MjkgNC40ODIyM0MxMy44NDM4IDQuMjQ0OTMgMTMuNTgyOSA0LjAyODU1IDEzLjMxMTEgMy44MzM5OUMxMy4yODI5IDMuODEzMDggMTMuMjU0NyAzLjc5MzA4IDEzLjIyNTYgMy43NzMwOEMxMC40NDAyIDEuODM2NTYgNi41NzMwMiAyLjEwOTMxIDQuMDkxMjQgNC41OTEzM0MxLjYwNTgyIDcuMDc2MDYgMS4zMzU4MyAxMC45NTA5IDMuMjgxMjUgMTMuNzM4NEMzLjMwNjcgMTMuNjIyIDMuMzMzOTggMTMuNTA1NyAzLjM2NDg5IDEzLjM5MDJDMy42MDQ4OCAxMi40OTY1IDQuMzMzMDUgMTEuNDA1NSA1LjE1ODUgMTAuMzgyN0M1LjQwMTIyIDkuMDY5ODYgNi4yNzQ4NCA3LjgxNjEyIDYuNzk0ODQgNy4yOTUxN0M3LjM2MzAxIDYuNzI3ODYgOC42MTkzNSA1Ljg1NTk3IDkuOTI1NyA1LjYzMzIyQzEwLjM3MTEgNS41NTc3NiAxMC44MjMgNS41NTc3NiAxMS4yNTU3IDUuNjcwNUMxMS42NzU3IDUuNzgwNTEgMTIuMDc3NSA1Ljk5ODcxIDEyLjQzNzUgNi4zNTc4M0wxMi40NDYxIDYuMzY2NkwxMi40NDYxIDYuMzY2NjJDMTIuNDkzOSA2LjQxNTMyIDEyLjU1NDUgNi40NzY5OSAxMi42MjQ3IDYuNTUyMzlDMTIuNzc5MyA2LjcxNzg1IDEyLjk4MiA2Ljk0NjA1IDEzLjIwNjYgNy4yMzUxN1pNMTQuOTA4NCAxNS44OTdDMTMuODY1NyAxNi4wNDI1IDEyLjI5MyAxNi4xMDUyIDEwLjUzMzEgMTUuNjI2MUM4LjcyMDM1IDE1LjEzMzMgNy40OTIxOSAxNC4zNTI0IDYuNzM3NjUgMTMuNzQ3OEM2LjY3MDM4IDEzLjk0NjkgNi42MjAzOCAxNC4xMTc4IDYuNTg0MDIgMTQuMjUyNEM2LjQ4MDM5IDE0LjYzOTcgNi40Nzc2NiAxNS4wMjMzIDYuNTc1ODQgMTUuMzkwNkM2LjY2NzY2IDE1LjcyOTcgNi44Mzg1NiAxNi4wNDI1IDcuMDU4NTYgMTYuMzI4QzguMjIxMjcgMTYuNzcyNSA5LjQwMjE2IDE3LjExNzEgMTAuMDk2NyAxNy4zMDYyQzEwLjgwMjEgMTcuNDk4MSAxMi4wMTg1IDE3LjgwNDQgMTMuMjczIDE4LjAwNjNDMTMuNzIzOSAxOC4wNzk5IDE0LjE3OTQgMTguMTM5OSAxNC42MTg0IDE4LjE3NTRDMTUuNDEyMSAxOC4yNDA4IDE2LjE0ODQgMTguMjI5OSAxNi43MDAyIDE4LjA4MTdDMTYuNzUwMiAxOC4wNjkgMTYuODAwMiAxOC4wNTQ1IDE2Ljg0OTMgMTguMDM5OUMxNy4xNzkzIDE3Ljk0NDUgMTcuNDk2NiAxNy44MjYzIDE3LjgwMTEgMTcuNjg4MUwxNy44OTY2IDE3LjY0NDRDMjAuOTY2NSAxNi4xOTk4IDIyLjY2MzggMTIuNzE0MSAyMS43NTU2IDkuMzIzNzlDMjAuODQ1NiA1LjkyODk4IDE3LjYyNTcgMy43NTY5OSAxNC4yNDAzIDQuMDQ4ODNDMTQuMzI2NiA0LjEyODgzIDE0LjQxMzkgNC4yMTA2NiAxNC40OTk0IDQuMjk1MjFDMTUuMTUzOSA0Ljk0OTgxIDE1LjczMzkgNi4xMjYyNiAxNi4yMDY2IDcuMzUyNzJDMTcuMjIyIDguMjE5MTUgMTcuODcxMSA5LjYwMjkgMTguMDYyIDEwLjMxMzlDMTguMjY5MyAxMS4wODk0IDE4LjM5NjYgMTIuNjEzMSAxNy45MzU3IDEzLjg1NkMxNy43Nzg0IDE0LjI3OTYgMTcuNTUyOSAxNC42NzA2IDE3LjIzODQgMTQuOTg4OEMxNi45MzMgMTUuMjk3OSAxNi41NDM5IDE1LjUzNyAxNi4wNTMgMTUuNjY4OEMxNS45ODQ4IDE1LjY4NzkgMTUuODk2NiAxNS43MDk3IDE1Ljc5MDIgMTUuNzM0M0MxNS41NzAzIDE1Ljc4NjEgMTUuMjcxMiAxNS44NDYxIDE0LjkwODQgMTUuODk3Wk04Ljk3NzYyIDkuMzgzNzlDNy42ODMwOSAxMC42NjkzIDYuOTUxMjkgMTIuMDYyMiA2LjU1NTg0IDEzLjAzODZDNi40MTg1NyAxMy4zNzg2IDYuMzIxMyAxMy42Njc4IDYuMjU0OTMgMTMuODg0MUM2LjIyNDAzIDEzLjk4NzggNi4xOTk0OCAxNC4wNzUxIDYuMTgxMyAxNC4xNDMzQzYuMDQ5NDggMTQuNjM1MSA2LjA2MjIxIDE1LjA5MTUgNi4xNzY3NSAxNS41MTA2QzYuMjk0OTMgMTUuOTQyNSA2LjUyMDM4IDE2LjMzMzQgNi44MDk0NyAxNi42ODE2QzcuNjU1ODIgMTcuNzAwOCA5LjAzODUzIDE4LjM1MzYgOS44MTM5NyAxOC41NjE4QzEwLjUyNDkgMTguNzUyNyAxMi4wNDc2IDE4Ljg4MTggMTMuMzA0OCAxOC40MzU0QzE0LjYwMzkgMTguNjM5MSAxNS45MTIxIDE4LjcyMzYgMTYuODA2NiAxOC40ODU0QzE2LjkyMyAxOC40NTQ1IDE3LjAzNzUgMTguNDE5IDE3LjE1MDIgMTguMzgzNkMxNS43MDkzIDIxLjQ2MiAxMi4yMTg1IDIzLjE2NDkgOC44MjQ5IDIyLjI1NTdDNS40MzQ5NSAyMS4zNDc1IDMuMjY0OTggMTguMTM0NSAzLjU0NzcgMTQuNzUzM0wzLjU1ODYxIDE0LjY0ODdDMy41OTEzNCAxNC4zMTYgMy42NDc3IDEzLjk4MjMgMy43Mjk1MiAxMy42NDc4QzMuNzQxMzMgMTMuNTk4NyAzLjc1NDA2IDEzLjU0NzggMy43Njc3IDEzLjQ5NzdDMy45MTQ5NyAxMi45NDY4IDQuMjc0MDUgMTIuMzAyMiA0LjcyNzY4IDExLjY0ODVDNC45Nzg1OSAxMS4yODY3IDUuMjU3NjggMTAuOTIxMiA1LjU0Njc2IDEwLjU2NzVDNi4zNDk0OCA5LjU4MjkgNy4yMjMxIDguNjgxOTIgNy43NDIxOCA4LjE2NzMzQzguMjUyMTggNy42NjAwMiA5LjE0MTI2IDYuODA5MDQgMTAuMTA3NiA2LjAyNTM1QzEwLjQ2NDkgNS45NzUzNCAxMC44MjEyIDUuOTg0NDMgMTEuMTYwMyA2LjA3NTM1QzExLjUyNzYgNi4xNzM1NCAxMS44NTg1IDYuMzY4MSAxMi4xNDIxIDYuNjUxNzZDMTIuMjQwMyA2Ljc0OTk1IDEyLjM2MyA2Ljg3OTA1IDEyLjUwMyA3LjAzNzI0QzExLjYwMjEgNy4zODgxOCAxMC4zMTAzIDguMDYwOTYgOC45Nzc2MiA5LjM4Mzc5WiIgZmlsbD0iIzQ3NDY1NSIvPgo8L3N2Zz4=",
          visible: true,
          isDefault: true,
        },
        {
          name: "Comment",
          color: "#005F9E",
          icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjUiIHZpZXdCb3g9IjAgMCAyNCAyNSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNyAzLjVWMTIuNUMxNyAxMy4wNSAxNi41NSAxMy41IDE2IDEzLjVINkwyIDE3LjVWMy41QzIgMi45NSAyLjQ1IDIuNSAzIDIuNUgxNkMxNi41NSAyLjUgMTcgMi45NSAxNyAzLjVaTTE5IDYuNUgyMUMyMS41NSA2LjUgMjIgNi45NSAyMiA3LjVWMjIuNUwxOCAxOC41SDdDNi40NSAxOC41IDYgMTguMDUgNiAxNy41VjE1LjVIMTlWNi41WiIgZmlsbD0iIzBENkFBOCIvPgo8L3N2Zz4=",
          visible: true,
          isDefault: false,
        },
        {
          name: "Issue",
          color: "#C81922",
          icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjUiIHZpZXdCb3g9IjAgMCAyNCAyNSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xMiAyLjVDNi40OCAyLjUgMiA2Ljk4IDIgMTIuNUMyIDE4LjAyIDYuNDggMjIuNSAxMiAyMi41QzE3LjUyIDIyLjUgMjIgMTguMDIgMjIgMTIuNUMyMiA2Ljk4IDE3LjUyIDIuNSAxMiAyLjVaTTExIDE3LjVWMTUuNUgxM1YxNy41SDExWk0xMSA3LjVWMTMuNUgxM1Y3LjVIMTFaIiBmaWxsPSIjRDUyQTMzIi8+Cjwvc3ZnPg==",
          visible: true,
          isDefault: false,
        },
        {
          name: "Request",
          color: "#005F9E",
          icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjUiIHZpZXdCb3g9IjAgMCAyNCAyNSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0zLjkgMy41SDIwLjFDMjAuNSAzLjUgMjEgMy45IDIxIDQuNFYyMC42QzIxIDIxIDIwLjUgMjEuNSAyMC4xIDIxLjVIMy45QzMuNCAyMS41IDMgMjEgMyAyMC42VjQuNEMzIDMuOSAzLjQgMy41IDMuOSAzLjVaTTE5IDE5LjVWNS41SDVWMTkuNUgxOVpNMTEgNy41SDE3VjkuNUgxMVY3LjVaTTE3IDExLjVIMTFWMTMuNUgxN1YxMS41Wk0xMSAxNS41SDE3VjE3LjVIMTFWMTUuNVpNOSA3LjVIN1Y5LjVIOVY3LjVaTTcgMTEuNUg5VjEzLjVIN1YxMS41Wk05IDE1LjVIN1YxNy41SDlWMTUuNVoiIGZpbGw9IiMwMDVGOUUiLz4KPC9zdmc+",
          visible: true,
          isDefault: false,
        },
        {
          name: "Fault",
          color: "#C81922",
          icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjUiIHZpZXdCb3g9IjAgMCAyNCAyNSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xLjg3MjQyIDIxLjczNUgyMi4xMjc0QzIyLjc5ODQgMjEuNzM1IDIzLjIxNzQgMjEuMDA4IDIyLjg4MTQgMjAuNDI4TDEyLjc1MzQgMi45MzVDMTIuNDE3NCAyLjM1NSAxMS41ODE0IDIuMzU1IDExLjI0NjQgMi45MzVMMS4xMTg0MiAyMC40MjhDMC43ODI0MTcgMjEuMDA4IDEuMjAxNDIgMjEuNzM1IDEuODcyNDIgMjEuNzM1TTExLjk5OTQgMTguNTYxVjE4LjU2MUMxMS40MTU0IDE4LjU2MSAxMC45NDE0IDE4LjA4OCAxMC45NDE0IDE3LjUwNEMxMC45NDE0IDE2LjkxOSAxMS40MTU0IDE2LjQ0NSAxMS45OTk0IDE2LjQ0NUMxMi41ODM0IDE2LjQ0NSAxMy4wNTc0IDE2LjkxOSAxMy4wNTc0IDE3LjUwNEMxMy4wNTc0IDE4LjA4OCAxMi41ODM0IDE4LjU2MSAxMS45OTk0IDE4LjU2MU0xMi44OTQ0IDE0LjMyOUgxMS4xMDU0QzExLjAxNTQgMTQuMzI5IDEwLjk0MTQgMTQuMjU2IDEwLjk0MTQgMTQuMTY1VjEwLjI2MUMxMC45NDE0IDEwLjE3MSAxMS4wMTU0IDEwLjA5NyAxMS4xMDU0IDEwLjA5N0gxMi44OTQ0QzEyLjk4NDQgMTAuMDk3IDEzLjA1NzQgMTAuMTcxIDEzLjA1NzQgMTAuMjYxVjE0LjE2NUMxMy4wNTc0IDE0LjI1NiAxMi45ODQ0IDE0LjMyOSAxMi44OTQ0IDE0LjMyOSIgZmlsbD0iI0M4MTkyMiIvPgo8L3N2Zz4=",
          visible: true,
          isDefault: false,
        },
        {
          name: "Inquiry",
          color: "#009AD9",
          icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjUiIHZpZXdCb3g9IjAgMCAyNCAyNSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xMi41IDIuNUM3LjgxIDIuNSA0IDYuMzEgNCAxMUM0IDE1LjY5IDcuODEgMTkuNSAxMi41IDE5LjVIMTNWMjIuNUMxNy44NiAyMC4xNiAyMSAxNS41IDIxIDExQzIxIDYuMzEgMTcuMTkgMi41IDEyLjUgMi41Wk0xMS41IDE3VjE1SDEzLjVWMTdIMTEuNVpNMTMuMjcwNCAxMC4zMjE3QzEyLjQ0MjEgMTAuOTU2NiAxMS41IDExLjY3ODcgMTEuNSAxMy41SDEzLjVDMTMuNSAxMi40MDQ2IDE0LjIxMSAxMS43ODMzIDE0Ljk0MDggMTEuMTQ1NUMxNS43MSAxMC40NzMzIDE2LjUgOS43ODI5MiAxNi41IDguNUMxNi41IDYuMjkgMTQuNzEgNC41IDEyLjUgNC41QzEwLjI5IDQuNSA4LjUgNi4yOSA4LjUgOC41SDEwLjVDMTAuNSA3LjQgMTEuNCA2LjUgMTIuNSA2LjVDMTMuNiA2LjUgMTQuNSA3LjQgMTQuNSA4LjVDMTQuNSA5LjM3OTIyIDEzLjkyMDIgOS44MjM2MSAxMy4yNzA0IDEwLjMyMTdaIiBmaWxsPSIjMDA5QUQ5Ii8+Cjwvc3ZnPg==",
          visible: true,
          isDefault: false,
        },
        {
          name: "Solution",
          color: "#4D6F33",
          icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjUiIHZpZXdCb3g9IjAgMCAyNCAyNSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xNi4zMjgxIDEwLjQ1MDhMMTEuMDkxMSAxNS42ODc4QzEwLjkzMzEgMTUuODQ1OCAxMC43MjYxIDE1LjkyNDggMTAuNTIxMSAxNS45MjQ4QzEwLjMxNDEgMTUuOTI0OCAxMC4xMDgxIDE1Ljg0NTggOS45NTExIDE1LjY4NzhMNy42NzMxIDEzLjQxMDhDNy4zNTgxIDEzLjA5NTggNy4zNTgxIDEyLjU4NTggNy42NzMxIDEyLjI3MDhDNy45ODgxIDExLjk1NTggOC40OTcxIDExLjk1NTggOC44MTIxIDEyLjI3MDhMMTAuNTIxMSAxMy45Nzg4TDE1LjE4OTEgOS4zMTA3NkMxNS41MDMxIDguOTk1NzYgMTYuMDEzMSA4Ljk5NTc2IDE2LjMyODEgOS4zMTA3NkMxNi42NDIxIDkuNjI1NzYgMTYuNjQyMSAxMC4xMzY4IDE2LjMyODEgMTAuNDUwOE0xMi4wMDAxIDIuNDk5NzZDNi40ODcxIDIuNDk5NzYgMi4wMDAxIDYuOTg1NzYgMi4wMDAxIDEyLjQ5OThDMi4wMDAxIDE4LjAxMzggNi40ODYxIDIyLjUwMDggMTIuMDAwMSAyMi41MDA4QzE3LjUxNTEgMjIuNTAwOCAyMi4wMDAxIDE4LjAxMzggMjIuMDAwMSAxMi40OTk4QzIyLjAwMDEgNi45ODU3NiAxNy41MTUxIDIuNDk5NzYgMTIuMDAwMSAyLjQ5OTc2IiBmaWxsPSIjNEQ2RjMzIi8+Cjwvc3ZnPg==",
          visible: true,
          isDefault: false,
        },
        {
          name: "Remark",
          color: "#363545",
          icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjUiIHZpZXdCb3g9IjAgMCAyNCAyNSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0yMC43MTAyIDcuNTQyMjRDMjEuMTAwMiA3LjE1MjI0IDIxLjEwMDIgNi41MjIyNCAyMC43MTAyIDYuMTMyMjRMMTguMzcwMiAzLjc5MjI0QzE4LjE4MzIgMy42MDUyNCAxNy45MzAyIDMuNTAwMjQgMTcuNjY1MiAzLjUwMDI0QzE3LjQwMDIgMy41MDAyNCAxNy4xNDcyIDMuNjA1MjQgMTYuOTYwMiAzLjc5MjI0TDE1LjEzMDIgNS42MjIyNEwxOC44ODAyIDkuMzcyMjRMMjAuNzEwMiA3LjU0MjI0Wk0xNC4wNTk4IDYuNjkyNjRMMi45OTk4IDE3Ljc1MjZWMjEuNTAyNkg2Ljc0OThMMTcuODA5OCAxMC40NDI2TDE0LjA1OTggNi42OTI2NFpNOS45MDEyIDIxLjUwMTZMMTMuMDAxMiAxOC40MDE2SDIxLjQwMTJWMjEuNTAxNkg5LjkwMTJaIiBmaWxsPSIjNDc0NjU1Ii8+Cjwvc3ZnPg==",
          visible: true,
          isDefault: false,
        },
        {
          name: "Clash",
          color: "#363545",
          icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjUiIHZpZXdCb3g9IjAgMCAyNCAyNSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0yMyAxNC4yMDVMMTkuMTUgMTEuNjJMMjIuMTIgOC4wNDVMMTcuNDQ1IDcuOTM1TDE3Ljk5NSAzLjMxNUwxNC4wMzUgNS43MzVMMTIgMS41TDkuOTY1IDUuNjhMNi4wMDUgMy4yNkw2LjU1NSA3Ljg4TDEuODggNy45OUw0Ljg1IDExLjU2NUwxIDE0LjE1TDUuNDU1IDE1LjU4TDMuNjQgMTkuODdMOC4xNSAxOC42Nkw4LjkyIDIzLjIyNUwxMi4wNTUgMTkuNzZMMTUuMTkgMjMuMjI1TDE1Ljk2IDE4LjY2TDIwLjQ3IDE5Ljg3TDE4LjY1NSAxNS41OEwyMyAxNC4yMDVaTTEwLjkgMTYuNzYyNVYxNC41NjI1SDEzLjFWMTYuNzYyNUgxMC45Wk0xMC45IDcuOTYyNVYxMy40NjI1SDEzLjFWNy45NjI1SDEwLjlaIiBmaWxsPSIjMzYzNTQ1Ii8+Cjwvc3ZnPg==",
          visible: true,
          isDefault: false,
        },
        {
          name: "123",
          color: "#C81922",
          icon: "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjUiIHZpZXdCb3g9IjAgMCAyNCAyNSIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZmlsbC1ydWxlPSJldmVub2RkIiBjbGlwLXJ1bGU9ImV2ZW5vZGQiIGQ9Ik0xMy4yMDY2IDcuMjM1MTdDMTMuODU0NyA4LjA2NjE0IDE0LjY5NDcgOS4zOTUzNCAxNS4xNjAyIDExLjE2QzE1LjY0MDIgMTIuOTc1NiAxNS41NzY1IDE0LjQzMTIgMTUuNDMwMiAxNS4zODY3QzE1LjYzNzQgMTUuMzQ0OSAxNS44MTAyIDE1LjMwMjIgMTUuOTQ0NyAxNS4yNjY3QzE2LjMzMiAxNS4xNjMxIDE2LjY2NTYgMTQuOTc0IDE2LjkzNDcgMTQuNzA0OEMxNy4xODI5IDE0LjQ1NTcgMTcuMzY4MyAxNC4xNTEyIDE3LjUwNDcgMTMuODE4NEMxNy4zMDkyIDEyLjU4OTIgMTcuMDE1NiAxMS4zOTM3IDE2LjgzMiAxMC42OTgyQzE2LjY0NTYgOS45OTA4NCAxNi4zMDI5IDguNzg0MzggMTUuODUxMSA3LjU5NjExQzE1LjY4OTIgNy4xNjk3MSAxNS41MTI5IDYuNzQ1MTMgMTUuMzI0NyA2LjM0NjkyQzE0Ljk4NDcgNS42MjY4NiAxNC42MDY1IDQuOTk0MDggMTQuMjAzOCA0LjU5MDQyTDE0LjA5MjkgNC40ODIyM0MxMy44NDM4IDQuMjQ0OTMgMTMuNTgyOSA0LjAyODU1IDEzLjMxMTEgMy44MzM5OUMxMy4yODI5IDMuODEzMDggMTMuMjU0NyAzLjc5MzA4IDEzLjIyNTYgMy43NzMwOEMxMC40NDAyIDEuODM2NTYgNi41NzMwMiAyLjEwOTMxIDQuMDkxMjQgNC41OTEzM0MxLjYwNTgyIDcuMDc2MDYgMS4zMzU4MyAxMC45NTA5IDMuMjgxMjUgMTMuNzM4NEMzLjMwNjcgMTMuNjIyIDMuMzMzOTggMTMuNTA1NyAzLjM2NDg5IDEzLjM5MDJDMy42MDQ4OCAxMi40OTY1IDQuMzMzMDUgMTEuNDA1NSA1LjE1ODUgMTAuMzgyN0M1LjQwMTIyIDkuMDY5ODYgNi4yNzQ4NCA3LjgxNjEyIDYuNzk0ODQgNy4yOTUxN0M3LjM2MzAxIDYuNzI3ODYgOC42MTkzNSA1Ljg1NTk3IDkuOTI1NyA1LjYzMzIyQzEwLjM3MTEgNS41NTc3NiAxMC44MjMgNS41NTc3NiAxMS4yNTU3IDUuNjcwNUMxMS42NzU3IDUuNzgwNTEgMTIuMDc3NSA1Ljk5ODcxIDEyLjQzNzUgNi4zNTc4M0wxMi40NDYxIDYuMzY2NkwxMi40NDYxIDYuMzY2NjJDMTIuNDkzOSA2LjQxNTMyIDEyLjU1NDUgNi40NzY5OSAxMi42MjQ3IDYuNTUyMzlDMTIuNzc5MyA2LjcxNzg1IDEyLjk4MiA2Ljk0NjA1IDEzLjIwNjYgNy4yMzUxN1pNMTQuOTA4NCAxNS44OTdDMTMuODY1NyAxNi4wNDI1IDEyLjI5MyAxNi4xMDUyIDEwLjUzMzEgMTUuNjI2MUM4LjcyMDM1IDE1LjEzMzMgNy40OTIxOSAxNC4zNTI0IDYuNzM3NjUgMTMuNzQ3OEM2LjY3MDM4IDEzLjk0NjkgNi42MjAzOCAxNC4xMTc4IDYuNTg0MDIgMTQuMjUyNEM2LjQ4MDM5IDE0LjYzOTcgNi40Nzc2NiAxNS4wMjMzIDYuNTc1ODQgMTUuMzkwNkM2LjY2NzY2IDE1LjcyOTcgNi44Mzg1NiAxNi4wNDI1IDcuMDU4NTYgMTYuMzI4QzguMjIxMjcgMTYuNzcyNSA5LjQwMjE2IDE3LjExNzEgMTAuMDk2NyAxNy4zMDYyQzEwLjgwMjEgMTcuNDk4MSAxMi4wMTg1IDE3LjgwNDQgMTMuMjczIDE4LjAwNjNDMTMuNzIzOSAxOC4wNzk5IDE0LjE3OTQgMTguMTM5OSAxNC42MTg0IDE4LjE3NTRDMTUuNDEyMSAxOC4yNDA4IDE2LjE0ODQgMTguMjI5OSAxNi43MDAyIDE4LjA4MTdDMTYuNzUwMiAxOC4wNjkgMTYuODAwMiAxOC4wNTQ1IDE2Ljg0OTMgMTguMDM5OUMxNy4xNzkzIDE3Ljk0NDUgMTcuNDk2NiAxNy44MjYzIDE3LjgwMTEgMTcuNjg4MUwxNy44OTY2IDE3LjY0NDRDMjAuOTY2NSAxNi4xOTk4IDIyLjY2MzggMTIuNzE0MSAyMS43NTU2IDkuMzIzNzlDMjAuODQ1NiA1LjkyODk4IDE3LjYyNTcgMy43NTY5OSAxNC4yNDAzIDQuMDQ4ODNDMTQuMzI2NiA0LjEyODgzIDE0LjQxMzkgNC4yMTA2NiAxNC40OTk0IDQuMjk1MjFDMTUuMTUzOSA0Ljk0OTgxIDE1LjczMzkgNi4xMjYyNiAxNi4yMDY2IDcuMzUyNzJDMTcuMjIyIDguMjE5MTUgMTcuODcxMSA5LjYwMjkgMTguMDYyIDEwLjMxMzlDMTguMjY5MyAxMS4wODk0IDE4LjM5NjYgMTIuNjEzMSAxNy45MzU3IDEzLjg1NkMxNy43Nzg0IDE0LjI3OTYgMTcuNTUyOSAxNC42NzA2IDE3LjIzODQgMTQuOTg4OEMxNi45MzMgMTUuMjk3OSAxNi41NDM5IDE1LjUzNyAxNi4wNTMgMTUuNjY4OEMxNS45ODQ4IDE1LjY4NzkgMTUuODk2NiAxNS43MDk3IDE1Ljc5MDIgMTUuNzM0M0MxNS41NzAzIDE1Ljc4NjEgMTUuMjcxMiAxNS44NDYxIDE0LjkwODQgMTUuODk3Wk04Ljk3NzYyIDkuMzgzNzlDNy42ODMwOSAxMC42NjkzIDYuOTUxMjkgMTIuMDYyMiA2LjU1NTg0IDEzLjAzODZDNi40MTg1NyAxMy4zNzg2IDYuMzIxMyAxMy42Njc4IDYuMjU0OTMgMTMuODg0MUM2LjIyNDAzIDEzLjk4NzggNi4xOTk0OCAxNC4wNzUxIDYuMTgxMyAxNC4xNDMzQzYuMDQ5NDggMTQuNjM1MSA2LjA2MjIxIDE1LjA5MTUgNi4xNzY3NSAxNS41MTA2QzYuMjk0OTMgMTUuOTQyNSA2LjUyMDM4IDE2LjMzMzQgNi44MDk0NyAxNi42ODE2QzcuNjU1ODIgMTcuNzAwOCA5LjAzODUzIDE4LjM1MzYgOS44MTM5NyAxOC41NjE4QzEwLjUyNDkgMTguNzUyNyAxMi4wNDc2IDE4Ljg4MTggMTMuMzA0OCAxOC40MzU0QzE0LjYwMzkgMTguNjM5MSAxNS45MTIxIDE4LjcyMzYgMTYuODA2NiAxOC40ODU0QzE2LjkyMyAxOC40NTQ1IDE3LjAzNzUgMTguNDE5IDE3LjE1MDIgMTguMzgzNkMxNS43MDkzIDIxLjQ2MiAxMi4yMTg1IDIzLjE2NDkgOC44MjQ5IDIyLjI1NTdDNS40MzQ5NSAyMS4zNDc1IDMuMjY0OTggMTguMTM0NSAzLjU0NzcgMTQuNzUzM0wzLjU1ODYxIDE0LjY0ODdDMy41OTEzNCAxNC4zMTYgMy42NDc3IDEzLjk4MjMgMy43Mjk1MiAxMy42NDc4QzMuNzQxMzMgMTMuNTk4NyAzLjc1NDA2IDEzLjU0NzggMy43Njc3IDEzLjQ5NzdDMy45MTQ5NyAxMi45NDY4IDQuMjc0MDUgMTIuMzAyMiA0LjcyNzY4IDExLjY0ODVDNC45Nzg1OSAxMS4yODY3IDUuMjU3NjggMTAuOTIxMiA1LjU0Njc2IDEwLjU2NzVDNi4zNDk0OCA5LjU4MjkgNy4yMjMxIDguNjgxOTIgNy43NDIxOCA4LjE2NzMzQzguMjUyMTggNy42NjAwMiA5LjE0MTI2IDYuODA5MDQgMTAuMTA3NiA2LjAyNTM1QzEwLjQ2NDkgNS45NzUzNCAxMC44MjEyIDUuOTg0NDMgMTEuMTYwMyA2LjA3NTM1QzExLjUyNzYgNi4xNzM1NCAxMS44NTg1IDYuMzY4MSAxMi4xNDIxIDYuNjUxNzZDMTIuMjQwMyA2Ljc0OTk1IDEyLjM2MyA2Ljg3OTA1IDEyLjUwMyA3LjAzNzI0QzExLjYwMjEgNy4zODgxOCAxMC4zMTAzIDguMDYwOTYgOC45Nzc2MiA5LjM4Mzc5WiIgZmlsbD0iIzQ3NDY1NSIvPgo8L3N2Zz4=",
          visible: true,
          isDefault: false,
        },
      ];
      const defaultTopicStatuses = [
        {
          name: "New",
          color: "#3684d1",
          icon: "tc-icon-circle",
          visible: true,
          isDefault: false,
        },
        {
          name: "In Progress",
          color: "#fcc603",
          icon: "tc-icon-circle",
          visible: true,
          isDefault: false,
        },
        {
          name: "Waiting",
          color: "#29b35b",
          icon: "tc-icon-circle",
          visible: true,
          isDefault: true,
        },
        {
          name: "Done",
          color: "#3684d1",
          icon: "tc-icon-circle",
          visible: true,
          isDefault: false,
        },
        {
          name: "Closed",
          color: "#36b7d1",
          icon: "tc-icon-circle",
          visible: false,
          isDefault: false,
        },
      ];

      const defaultTopicPriorities = [
        {
          name: "Low",
          color: "#72A544",
          icon: "tc-icon-bookmark",
          visible: true,
          isDefault: true,
        },
        {
          name: "Normal",
          color: "#005F9E",
          icon: "tc-icon-bookmark",
          visible: true,
          isDefault: false,
        },
        {
          name: "High",
          color: "#FFBE00",
          icon: "tc-icon-bookmark",
          visible: true,
          isDefault: false,
        },
        {
          name: "Critical",
          color: "#C81922",
          icon: "tc-icon-bookmark",
          visible: true,
          isDefault: false,
        },
      ];

      const typePromises = defaultTopicTypes.map((topic) => {
        return TopicType.create({ ...topic, projectId });
      });

      const statusPromises = defaultTopicStatuses.map((topic) => {
        return TopicStatus.create({ ...topic, projectId });
      });

      const priorityPromises = defaultTopicPriorities.map((topic) => {
        return TopicPriority.create({ ...topic, projectId });
      });

      await Promise.all([
        ...typePromises,
        ...statusPromises,
        ...priorityPromises,
      ]);

      return { message: "Default topics created successfully." };
    } catch (error: any) {
      console.error(error);
      throw new Error(`Error creating default topics: ${error.message}`);
    }
  }

  // ================================
  // TOPIC ITEMS (BCF Topics instances)
  // ================================

  async createTopicItem(
    userId: Types.ObjectId | undefined,
    projectId: string,
    payload: {
      title: string;
      description?: string;
      assignee?: string;
      type?: string;
      status?: string;
      priority?: string;
      tags?: string[];
      dueDate?: Date;
      authorName?: string;
      /** Primary file this topic is about (recommended for ISO gate) */
      fileId?: string;
      linkedFileVersion?: number;
    },
  ) {
    const actorRole = await this.getActorRole(projectId, userId);
    if (actorRole === "MEMBER") {
      throw new AppError("Only Admin or Group Leader can create topics.", 403);
    }

    const count = await TopicItemModel.countDocuments({ projectId });
    const code = `THEBU-${count + 1}`;
    const now = new Date();

    const safeTitle = sanitizeTopicTitle(payload.title);
    assertValidTopicTitle(safeTitle);
    assertTagsInputWithinLimits(payload.tags);
    const safeTags = sanitizeTopicTags(payload.tags);
    const safeDescription = sanitizeTopicDescription(payload.description ?? "");
    const safeAssignee = sanitizeTopicAssignee(payload.assignee ?? "");
    const type = parseTopicType(payload.type ?? "Undefined");
    const status = parseTopicStatus(payload.status ?? "New");
    const priority = parseTopicPriority(payload.priority ?? "Normal");
    const dueDate = parseOptionalTopicDueDate(payload.dueDate);
    const due = dueDate === undefined ? null : dueDate;

    const fileId =
      payload.fileId && Types.ObjectId.isValid(payload.fileId)
        ? new Types.ObjectId(payload.fileId)
        : null;
    const linkedFileVersion =
      typeof payload.linkedFileVersion === "number" &&
      !Number.isNaN(payload.linkedFileVersion)
        ? payload.linkedFileVersion
        : null;

    const doc = await TopicItemModel.create({
      projectId: new Types.ObjectId(projectId),
      code,
      title: safeTitle,
      description: safeDescription,
      assignee: safeAssignee,
      type,
      status,
      priority,
      tags: safeTags,
      dueDate: due,
      authorName: payload.authorName ?? "Unknown",
      authorUserId: userId ?? null,
      fileId,
      linkedFileVersion,
      thumbnailUrl: "",
      stats: { comments: 0, viewpoints: 0, attachments: 0 },
      attachments: [],
      createdAt: now,
      updatedAt: now,
    });

    return doc.toObject();
  }

  async updateTopicItem(
    userId: Types.ObjectId | undefined,
    topicItemId: string,
    payload: {
      title?: string;
      description?: string;
      assignee?: string;
      type?: string;
      status?: string;
      priority?: string;
      tags?: string[];
      dueDate?: Date | null;
    },
  ) {
    const topicItem = await TopicItemModel.findById(topicItemId);
    if (!topicItem) throw new Error("Topic item not found");

    const actorRole = await this.getActorRole(topicItem.projectId.toString(), userId);

    if (payload.status !== undefined) {
      const nextStatus = parseTopicStatus(payload.status);
      if (isTopicResolutionStatus(nextStatus)) {
        const openTodos = await countNonTerminalTodosForTopic(topicItemId);
        if (openTodos > 0) {
          throw new AppError(
            "Cannot resolve or close this topic while linked todos are still open.",
            409,
          );
        }
      }
      if (nextStatus === "Closed" && actorRole !== "ADMIN") {
        throw new AppError("Only Admin can close a topic.", 403);
      }
      if (
        (nextStatus === "Done" || nextStatus === "Resolved") &&
        actorRole === "MEMBER"
      ) {
        throw new AppError(
          "Only Group Leader or Admin can resolve a topic.",
          403,
        );
      }
      topicItem.status = nextStatus;
      delete payload.status;
    }

    if (payload.title !== undefined) {
      const t = sanitizeTopicTitle(payload.title);
      assertValidTopicTitle(t);
      topicItem.title = t;
    }
    if (payload.description !== undefined) {
      topicItem.description = sanitizeTopicDescription(payload.description);
    }
    if (payload.assignee !== undefined) {
      topicItem.assignee = sanitizeTopicAssignee(payload.assignee);
    }
    if (payload.type !== undefined) {
      topicItem.type = parseTopicType(payload.type);
    }
    if (payload.priority !== undefined) {
      topicItem.priority = parseTopicPriority(payload.priority);
    }
    if (payload.tags !== undefined) {
      assertTagsInputWithinLimits(payload.tags);
      topicItem.tags = sanitizeTopicTags(payload.tags);
    }
    if (payload.dueDate !== undefined) {
      const d = parseOptionalTopicDueDate(payload.dueDate);
      topicItem.dueDate = d === null || d === undefined ? undefined : d;
    }

    await topicItem.save();

    return topicItem.toObject();
  }

  async getAllTopicItems(
    userId: Types.ObjectId | undefined,
    projectId: string,
  ) {
    try {
      const member = await projectMemberSchema.findOne({
        userId,
        projectId,
      });

      if (!member) {
        throw new Error("Bạn không có quyền truy cập vào dự án này.");
      }

      let topics = await TopicItemModel.find({ projectId })
        .sort({ updatedAt: -1 })
        .lean();

      if (!topics || topics.length === 0) {
        // Ensure FE always has something to render
        await this.createTopicItemsDefault(new Types.ObjectId(projectId));
        topics = await TopicItemModel.find({ projectId })
          .sort({ updatedAt: -1 })
          .lean();
      }

      return topics;
    } catch (error) {
      throw error;
    }
  }

  async addTopicAttachments(
    userId: Types.ObjectId | undefined,
    topicItemId: string,
    attachments: any[],
  ) {
    const topicItem = await TopicItemModel.findById(topicItemId);
    if (!topicItem) throw new Error("Topic item not found");

    const member = await projectMemberSchema.findOne({
      userId,
      projectId: topicItem.projectId,
    });
    if (!member) throw new Error("Bạn không có quyền truy cập vào dự án này.");

    const safeAttachments = Array.isArray(attachments) ? attachments : [];

    const normalized = safeAttachments
      .map((a) => ({
        name: String(a?.name ?? ""),
        url: String(a?.url ?? ""),
        mimeType: a?.mimeType ? String(a.mimeType) : undefined,
        size: typeof a?.size === "number" ? a.size : undefined,
        fileId: a?.fileId ? String(a.fileId) : undefined,
      }))
      .filter((a) => a.name && a.url);

    const currentLen = (topicItem.attachments ?? []).length;
    if (currentLen + normalized.length > TOPIC_ATTACHMENTS_MAX) {
      throw new AppError(
        `At most ${TOPIC_ATTACHMENTS_MAX} references per topic.`,
        400,
      );
    }

    topicItem.attachments = [...(topicItem.attachments ?? []), ...normalized];
    topicItem.stats = topicItem.stats ?? { comments: 0, viewpoints: 0, attachments: 0 };
    topicItem.stats.attachments = topicItem.attachments.length;
    await topicItem.save();

    return topicItem;
  }

  async removeTopicAttachment(
    userId: Types.ObjectId | undefined,
    topicItemId: string,
    url: string,
  ) {
    const topicItem = await TopicItemModel.findById(topicItemId);
    if (!topicItem) throw new Error("Topic item not found");

    const member = await projectMemberSchema.findOne({
      userId,
      projectId: topicItem.projectId,
    });
    if (!member) throw new Error("Bạn không có quyền truy cập vào dự án này.");

    const next = (topicItem.attachments ?? []).filter((a: any) => a.url !== url);
    topicItem.attachments = next;
    topicItem.stats = topicItem.stats ?? { comments: 0, viewpoints: 0, attachments: 0 };
    topicItem.stats.attachments = topicItem.attachments.length;
    await topicItem.save();

    return topicItem;
  }

  async removeAllTopicAttachments(
    userId: Types.ObjectId | undefined,
    topicItemId: string,
  ) {
    const topicItem = await TopicItemModel.findById(topicItemId);
    if (!topicItem) throw new Error("Topic item not found");

    const member = await projectMemberSchema.findOne({
      userId,
      projectId: topicItem.projectId,
    });
    if (!member) throw new Error("Bạn không có quyền truy cập vào dự án này.");

    topicItem.attachments = [];
    topicItem.stats = topicItem.stats ?? { comments: 0, viewpoints: 0, attachments: 0 };
    topicItem.stats.attachments = 0;
    await topicItem.save();

    return topicItem;
  }

  // Create some default topic items so FE has data to render
  async createTopicItemsDefault(projectId: Types.ObjectId) {
    try {
      const exists = await TopicItemModel.findOne({ projectId }).lean();
      if (exists) return { message: "Default topic items already exist." };

      const now = new Date();

      const defaultItems = [
        {
          code: "THEBU-5",
          title: "new",
          description: "new",
          assignee: "",
          type: "Issue",
          status: "New",
          priority: "Low",
          tags: ["Issue"],
          dueDate: null,
          authorName: "Hao Nguyen",
          thumbnailUrl: "",
          attachments: [],
          stats: { comments: 0, viewpoints: 3, attachments: 0 },
          projectId,
          createdAt: now,
          updatedAt: now,
        },
        {
          code: "THEBU-4",
          title: "test Topic1",
          description: "",
          assignee: "",
          type: "Issue",
          status: "New",
          priority: "Normal",
          tags: ["Issue"],
          dueDate: null,
          authorName: "Tran Hoang Phuc",
          thumbnailUrl: "",
          attachments: [],
          stats: { comments: 0, viewpoints: 0, attachments: 0 },
          projectId,
          createdAt: now,
          updatedAt: now,
        },
        {
          code: "THEBU-3",
          title: "example",
          description: "",
          assignee: "",
          type: "Comment",
          status: "In Progress",
          priority: "Normal",
          tags: [],
          dueDate: null,
          authorName: "Hao Nguyen",
          thumbnailUrl: "",
          attachments: [],
          stats: { comments: 0, viewpoints: 0, attachments: 0 },
          projectId,
          createdAt: now,
          updatedAt: now,
        },
        {
          code: "THEBU-2",
          title: "aaaa",
          description: "",
          assignee: "",
          type: "Undefined",
          status: "Done",
          priority: "Normal",
          tags: [],
          dueDate: null,
          authorName: "Tran Hoang Phuc",
          thumbnailUrl: "",
          attachments: [],
          stats: { comments: 0, viewpoints: 0, attachments: 0 },
          projectId,
          createdAt: now,
          updatedAt: now,
        },
      ];

      await TopicItemModel.insertMany(defaultItems);
      return { message: "Default topic items created successfully." };
    } catch (error: any) {
      throw new Error(`Error creating default topic items: ${error.message}`);
    }
  }
}
