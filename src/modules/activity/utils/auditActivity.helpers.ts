import type { Request } from "express";
import type { CreateActivityDTO } from "../interfaces/activity.interface";
import ActivityService from "../services/activity.service";

const activityService = new ActivityService();

/**
 * Fire-and-forget activity log; failures must not break the main request.
 */
export async function logActivitySafe(
  dto: CreateActivityDTO,
): Promise<void> {
  try {
    await activityService.logActivity(dto);
  } catch (err) {
    console.error("[audit] logActivity failed:", err);
  }
}

export function actorFromReq(
  req: Request,
): CreateActivityDTO["actor"] | null {
  const u = (req as Request & { user?: { _id: unknown; fullName?: string; email?: string } })
    .user;
  if (!u?._id) return null;
  return {
    userId: u._id as CreateActivityDTO["actor"]["userId"],
    fullName: u.fullName ?? "User",
    email: u.email,
  };
}

export function projectIdToString(pid: unknown): string {
  if (pid != null && typeof pid === "object" && "toString" in pid) {
    return String((pid as { toString(): string }).toString());
  }
  return String(pid ?? "");
}
