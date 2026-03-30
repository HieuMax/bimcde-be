import { AppError } from "../../../utils/AppError";

export const RELEASE_NAME_MAX_LENGTH = 150;
export const RELEASE_NOTE_MAX_LENGTH = 500;

/** Strip risky markup / angle brackets / obvious script tags, then trim & cap length */
export function sanitizeReleaseName(raw: unknown): string {
  let s = String(raw ?? "").trim();
  s = s.replace(/<\s*\/?\s*script[^>]*>/gi, "");
  s = s.replace(/<\s*script\b/gi, "");
  s = s.replace(/[<>]/g, "");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > RELEASE_NAME_MAX_LENGTH) {
    s = s.slice(0, RELEASE_NAME_MAX_LENGTH).trim();
  }
  return s;
}

export function assertValidReleaseName(sanitized: string): void {
  if (!sanitized) {
    throw new AppError("Release name is required.", 400);
  }
}

/**
 * Optional note: XSS-oriented cleanup + length cap. Returns undefined if empty after trim.
 */
export function sanitizeReleaseNote(raw: unknown): string | undefined {
  if (raw === undefined || raw === null) return undefined;
  let s = String(raw);
  s = s.replace(/<\s*\/?\s*script[^>]*>/gi, "");
  s = s.replace(/<\s*\/?\s*iframe[^>]*>/gi, "");
  s = s.replace(/<\s*script\b/gi, "");
  s = s.replace(/[<>]/g, "");
  s = s.replace(/javascript\s*:/gi, "");
  s = s.replace(/data\s*:\s*text\/html/gi, "");
  s = s.replace(/on\w+\s*=/gi, "");
  s = s.trim();
  if (s.length > RELEASE_NOTE_MAX_LENGTH) {
    s = s.slice(0, RELEASE_NOTE_MAX_LENGTH).trim();
  }
  return s.length > 0 ? s : undefined;
}

/**
 * Parses due date from `yyyy-MM-dd` (preferred from client) or ISO / timestamp.
 * Compares end of that **calendar day in UTC** to now so “today” is invalid once the day has ended in UTC.
 * For `yyyy-MM-dd`, the calendar day is unambiguous.
 */
export function parseAndAssertFutureDueDate(input: unknown): Date {
  if (input === undefined || input === null) {
    throw new AppError("Due date is required.", 400);
  }

  const raw = String(input).trim();
  const ymd = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);

  let y: number;
  let mo: number;
  let da: number;

  if (ymd) {
    y = Number(ymd[1]);
    mo = Number(ymd[2]) - 1;
    da = Number(ymd[3]);
    if (mo < 0 || mo > 11 || da < 1 || da > 31) {
      throw new AppError("Invalid due date.", 400);
    }
  } else {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      throw new AppError("Invalid due date.", 400);
    }
    y = d.getUTCFullYear();
    mo = d.getUTCMonth();
    da = d.getUTCDate();
  }

  const endUtc = new Date(Date.UTC(y, mo, da, 23, 59, 59, 999));

  if (endUtc.getTime() <= Date.now()) {
    throw new AppError("Due date must be in the future.", 400);
  }

  return endUtc;
}
