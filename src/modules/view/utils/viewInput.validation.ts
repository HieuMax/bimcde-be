import { Types } from "mongoose";
import { AppError } from "../../../utils/AppError";

export const VIEW_NAME_MAX_LENGTH = 150;
export const VIEW_DESCRIPTION_MAX_LENGTH = 500;
export const VIEW_TAGS_MAX_COUNT = 20;

export function sanitizeViewName(raw: unknown): string {
  let s = String(raw ?? "").trim();
  s = s.replace(/<\s*\/?\s*script[^>]*>/gi, "");
  s = s.replace(/<\s*script\b/gi, "");
  s = s.replace(/[<>]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > VIEW_NAME_MAX_LENGTH) {
    s = s.slice(0, VIEW_NAME_MAX_LENGTH).trim();
  }
  return s;
}

export function assertValidViewName(sanitized: string): void {
  if (!sanitized) {
    throw new AppError("Name is required.", 400);
  }
}

export function sanitizeViewDescription(raw: unknown): string {
  let s = String(raw ?? "");
  s = s.replace(/<\s*\/?\s*script[^>]*>/gi, "");
  s = s.replace(/<\s*\/?\s*iframe[^>]*>/gi, "");
  s = s.replace(/<\s*script\b/gi, "");
  s = s.replace(/[<>]/g, "");
  s = s.replace(/javascript\s*:/gi, "");
  s = s.replace(/data\s*:\s*text\/html/gi, "");
  s = s.replace(/on\w+\s*=/gi, "");
  s = s.trim();
  if (s.length > VIEW_DESCRIPTION_MAX_LENGTH) {
    s = s.slice(0, VIEW_DESCRIPTION_MAX_LENGTH).trim();
  }
  return s;
}

export function assertDescriptionWithinLimit(raw: unknown): void {
  const t = String(raw ?? "").trim();
  if (t.length > VIEW_DESCRIPTION_MAX_LENGTH) {
    throw new AppError(
      `Description must be at most ${VIEW_DESCRIPTION_MAX_LENGTH} characters.`,
      400,
    );
  }
}

/** Normalize tag id strings; drop invalid ObjectIds; cap count */
export function normalizeViewTagIds(raw: unknown): string[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new AppError("Tags must be an array of ids.", 400);
  }
  if (raw.length > VIEW_TAGS_MAX_COUNT) {
    throw new AppError(
      `At most ${VIEW_TAGS_MAX_COUNT} tags allowed.`,
      400,
    );
  }
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const id = String(item ?? "").trim();
    if (!id || !Types.ObjectId.isValid(id)) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
