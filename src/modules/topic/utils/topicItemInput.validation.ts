import { AppError } from "../../../utils/AppError";

export const TOPIC_TITLE_MAX_LENGTH = 200;
export const TOPIC_DESCRIPTION_MAX_LENGTH = 5000;
export const TOPIC_ASSIGNEE_MAX_LENGTH = 200;
export const TOPIC_TAGS_MAX_COUNT = 20;
export const TOPIC_TAG_MAX_LENGTH = 48;

const TOPIC_TYPES = [
  "Undefined",
  "Comment",
  "Issue",
  "Request",
  "Fault",
  "Inquiry",
  "Solution",
  "Remark",
  "Clash",
] as const;

const TOPIC_STATUSES = [
  "New",
  "In Progress",
  "Waiting",
  "Done",
  "Resolved",
  "Closed",
] as const;

const TOPIC_PRIORITIES = ["Low", "Normal", "High", "Critical"] as const;

type TopicType = (typeof TOPIC_TYPES)[number];
type TopicStatus = (typeof TOPIC_STATUSES)[number];
type TopicPriority = (typeof TOPIC_PRIORITIES)[number];

function stripRiskyMarkup(s: string, maxLen: number): string {
  let out = s;
  out = out.replace(/<\s*\/?\s*script[^>]*>/gi, "");
  out = out.replace(/<\s*\/?\s*iframe[^>]*>/gi, "");
  out = out.replace(/<\s*script\b/gi, "");
  out = out.replace(/[<>]/g, "");
  out = out.replace(/javascript\s*:/gi, "");
  out = out.replace(/data\s*:\s*text\/html/gi, "");
  out = out.replace(/on\w+\s*=/gi, "");
  out = out.replace(/\s+/g, " ").trim();
  if (out.length > maxLen) out = out.slice(0, maxLen).trim();
  return out;
}

export function sanitizeTopicTitle(raw: unknown): string {
  let s = String(raw ?? "").trim();
  s = s.replace(/<\s*\/?\s*script[^>]*>/gi, "");
  s = s.replace(/<\s*script\b/gi, "");
  s = s.replace(/[<>]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > TOPIC_TITLE_MAX_LENGTH) {
    s = s.slice(0, TOPIC_TITLE_MAX_LENGTH).trim();
  }
  return s;
}

export function assertValidTopicTitle(sanitized: string): void {
  if (!sanitized) {
    throw new AppError("Title is required.", 400);
  }
}

export function sanitizeTopicDescription(raw: unknown): string {
  return stripRiskyMarkup(String(raw ?? ""), TOPIC_DESCRIPTION_MAX_LENGTH);
}

export function sanitizeTopicAssignee(raw: unknown): string {
  let s = String(raw ?? "").trim();
  s = s.replace(/<\s*\/?\s*script[^>]*>/gi, "");
  s = s.replace(/<\s*script\b/gi, "");
  s = s.replace(/[<>]/g, "");
  if (s.length > TOPIC_ASSIGNEE_MAX_LENGTH) {
    s = s.slice(0, TOPIC_ASSIGNEE_MAX_LENGTH).trim();
  }
  return s;
}

function sanitizeSingleTag(raw: string): string {
  return stripRiskyMarkup(raw, TOPIC_TAG_MAX_LENGTH);
}

export function sanitizeTopicTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of raw) {
    const s = sanitizeSingleTag(String(t));
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
    if (out.length > TOPIC_TAGS_MAX_COUNT) break;
  }
  return out;
}

export function assertTagsInputWithinLimits(raw: unknown): void {
  if (!Array.isArray(raw)) return;
  if (raw.length > TOPIC_TAGS_MAX_COUNT) {
    throw new AppError(
      `At most ${TOPIC_TAGS_MAX_COUNT} tags allowed.`,
      400,
    );
  }
  for (const t of raw) {
    if (String(t).trim().length > TOPIC_TAG_MAX_LENGTH) {
      throw new AppError(
        `Each tag must be at most ${TOPIC_TAG_MAX_LENGTH} characters.`,
        400,
      );
    }
  }
}

export function parseTopicType(v: unknown): TopicType {
  const s = String(v ?? "");
  if (!TOPIC_TYPES.includes(s as TopicType)) {
    throw new AppError("Invalid topic type.", 400);
  }
  return s as TopicType;
}

export function parseTopicStatus(v: unknown): TopicStatus {
  const s = String(v ?? "");
  if (!TOPIC_STATUSES.includes(s as TopicStatus)) {
    throw new AppError("Invalid topic status.", 400);
  }
  return s as TopicStatus;
}

export function parseTopicPriority(v: unknown): TopicPriority {
  const s = String(v ?? "");
  if (!TOPIC_PRIORITIES.includes(s as TopicPriority)) {
    throw new AppError("Invalid topic priority.", 400);
  }
  return s as TopicPriority;
}

/** Optional due date from ISO string, `yyyy-MM-dd`, or null to clear. */
export function parseOptionalTopicDueDate(
  input: unknown,
): Date | null | undefined {
  if (input === undefined) return undefined;
  if (input === null || input === "") return null;
  const d = new Date(String(input));
  if (Number.isNaN(d.getTime())) {
    throw new AppError("Invalid due date.", 400);
  }
  return d;
}
