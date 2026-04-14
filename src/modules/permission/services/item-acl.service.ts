import { Types } from "mongoose";
import itemAclModel from "../schemas/item-acl.schema";
import FolderModel from "../../folder/schemas/folder.schema";
import FileModel from "../../file/schemas/file.schema";
import projectMemberSchema from "../../project/schemas/project-member.schema";
import groupModel from "../../team/schemas/group.schema";
import AccountModel from "../../account/schemas/account.schema";
import { AppError } from "../../../utils/AppError";
import {
  GrantSubjectType,
  ItemAccessLevel,
  ItemResourceType,
} from "../interfaces/item-acl.interface";

const ACCESS_SET = new Set<ItemAccessLevel>(["FULL", "READ_ONLY", "NO_ACCESS"]);

function assertObjectId(id: string, field: string): Types.ObjectId {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError(`Invalid ${field}`, 400);
  }
  return new Types.ObjectId(id);
}

export interface ItemAclPayload {
  defaultAccess: ItemAccessLevel;
  inheritFromParent?: boolean;
  explicitGrants: Array<{
    recipient: { id: string; type: GrantSubjectType; label?: string; email?: string };
    access: ItemAccessLevel;
  }>;
}

export interface ItemAclResponse {
  mode: ItemResourceType;
  itemId: string;
  defaultAccess: ItemAccessLevel;
  inheritFromParent: boolean;
  explicitGrants: Array<{
    recipient: {
      id: string;
      type: GrantSubjectType;
      label: string;
      email?: string;
    };
    access: ItemAccessLevel;
  }>;
}

export default class ItemAclService {
  private async assertProjectMember(projectId: string, userId: Types.ObjectId) {
    const member = await projectMemberSchema.findOne({
      projectId,
      userId,
    });
    if (!member) {
      throw new AppError("Bạn không có quyền truy cập vào dự án này.", 403);
    }
  }

  private async assertResourceInProject(
    projectId: string,
    resourceType: ItemResourceType,
    resourceId: Types.ObjectId
  ) {
    try {
      if (resourceType === "folder") {
        const folder = await FolderModel.findOne({
          _id: resourceId,
          projectId,
          isDeleted: false,
        }).lean();
        if (!folder) throw new AppError("Folder not found", 404);
        return;
      }
      const file = await FileModel.findOne({
        _id: resourceId,
        projectId,
        isDeleted: false,
      }).lean();
      if (!file) throw new AppError("File not found", 404);
    } catch (e: any) {
      if (e instanceof AppError) throw e;
      throw new AppError("Invalid resource", 400);
    }
  }

  private async validateGrantSubject(
    projectId: string,
    subjectType: GrantSubjectType,
    subjectId: Types.ObjectId
  ) {
    if (subjectType === "USER") {
      const member = await projectMemberSchema.findOne({
        projectId,
        userId: subjectId,
      });
      if (!member) {
        throw new AppError("Grant user must be a project member", 400);
      }
      return;
    }
    const group = await groupModel.findOne({
      _id: subjectId,
      projectId,
    });
    if (!group) {
      throw new AppError("Grant group must belong to this project", 400);
    }
  }

  private dedupeGrants(
    grants: Array<{ subjectType: GrantSubjectType; subjectId: Types.ObjectId; access: ItemAccessLevel }>
  ) {
    const map = new Map<string, (typeof grants)[0]>();
    for (const g of grants) {
      map.set(`${g.subjectType}:${g.subjectId.toString()}`, g);
    }
    return [...map.values()];
  }

  private async enrichGrants(
    projectId: Types.ObjectId,
    grants: Array<{
      subjectType: GrantSubjectType;
      subjectId: Types.ObjectId;
      access: ItemAccessLevel;
    }>
  ): Promise<ItemAclResponse["explicitGrants"]> {
    if (grants.length === 0) return [];

    const userIds = grants
      .filter((g) => g.subjectType === "USER")
      .map((g) => g.subjectId);
    const groupIds = grants
      .filter((g) => g.subjectType === "GROUP")
      .map((g) => g.subjectId);

    const [accounts, groups] = await Promise.all([
      userIds.length
        ? AccountModel.find({ _id: { $in: userIds } })
            .select("fullName email")
            .lean()
        : [],
      groupIds.length
        ? groupModel
            .find({ _id: { $in: groupIds }, projectId })
            .select("name")
            .lean()
        : [],
    ]);

    const userMap = new Map(accounts.map((a: any) => [a._id.toString(), a]));
    const groupMap = new Map(groups.map((g: any) => [g._id.toString(), g]));

    return grants.map((g) => {
      if (g.subjectType === "USER") {
        const u = userMap.get(g.subjectId.toString()) as
          | { fullName?: string; email?: string }
          | undefined;
        return {
          recipient: {
            id: g.subjectId.toString(),
            type: "USER" as const,
            label: u?.fullName ?? "Unknown user",
            email: u?.email,
          },
          access: g.access,
        };
      }
      const gr = groupMap.get(g.subjectId.toString()) as { name?: string } | undefined;
      return {
        recipient: {
          id: g.subjectId.toString(),
          type: "GROUP" as const,
          label: gr?.name ?? "Unknown group",
        },
        access: g.access,
      };
    });
  }

  async getItemAcl(
    projectId: string,
    resourceType: string,
    resourceId: string,
    userId: Types.ObjectId | undefined
  ): Promise<ItemAclResponse> {
    if (!userId) throw new AppError("User không hợp lệ.", 401);
    if (resourceType !== "folder" && resourceType !== "file") {
      throw new AppError("Invalid resource type", 400);
    }

    const pid = assertObjectId(projectId, "projectId");
    const rid = assertObjectId(resourceId, "resourceId");

    await this.assertProjectMember(projectId, userId);
    await this.assertResourceInProject(projectId, resourceType, rid);

    const doc = await itemAclModel
      .findOne({
        projectId: pid,
        resourceType,
        resourceId: rid,
      })
      .lean();

    const defaultAccess: ItemAccessLevel = doc?.defaultAccess ?? "FULL";
    const inheritFromParent =
      resourceType === "folder" ? (doc?.inheritFromParent ?? true) : false;

    const grants = doc?.grants ?? [];
    const explicitGrants = await this.enrichGrants(pid, grants);

    return {
      mode: resourceType,
      itemId: resourceId,
      defaultAccess,
      inheritFromParent,
      explicitGrants,
    };
  }

  async upsertItemAcl(
    projectId: string,
    resourceType: string,
    resourceId: string,
    userId: Types.ObjectId | undefined,
    body: ItemAclPayload
  ): Promise<ItemAclResponse> {
    if (!userId) throw new AppError("User không hợp lệ.", 401);
    if (resourceType !== "folder" && resourceType !== "file") {
      throw new AppError("Invalid resource type", 400);
    }

    const pid = assertObjectId(projectId, "projectId");
    const rid = assertObjectId(resourceId, "resourceId");

    if (!ACCESS_SET.has(body.defaultAccess)) {
      throw new AppError("Invalid defaultAccess", 400);
    }

    await this.assertProjectMember(projectId, userId);
    await this.assertResourceInProject(projectId, resourceType, rid);

    const inheritFromParent =
      resourceType === "folder" ? Boolean(body.inheritFromParent) : false;

    const rawGrants: Array<{
      subjectType: GrantSubjectType;
      subjectId: Types.ObjectId;
      access: ItemAccessLevel;
    }> = [];

    for (const row of body.explicitGrants ?? []) {
      const access = row.access;
      if (!ACCESS_SET.has(access)) {
        throw new AppError("Invalid grant access level", 400);
      }
      const st = row.recipient?.type;
      if (st !== "USER" && st !== "GROUP") {
        throw new AppError("Invalid grant subject type", 400);
      }
      const sid = assertObjectId(row.recipient.id, "recipient.id");
      await this.validateGrantSubject(projectId, st, sid);
      rawGrants.push({ subjectType: st, subjectId: sid, access });
    }

    const grants = this.dedupeGrants(rawGrants);

    await itemAclModel.findOneAndUpdate(
      { projectId: pid, resourceType, resourceId: rid },
      {
        $set: {
          defaultAccess: body.defaultAccess,
          inheritFromParent,
          grants,
        },
      },
      { upsert: true, new: true }
    );

    return this.getItemAcl(projectId, resourceType, resourceId, userId);
  }
}
