import { AppError } from "../../../utils/AppError";

/** Characters not allowed in Windows-style file/folder names */
const INVALID_FOLDER_NAME_CHARS = /[\\/:*?"<>|]/;

export const MAX_FOLDER_NAME_LENGTH = 150;

/** Maximum depth of a folder from project root (root-level folder = depth 1) */
export const MAX_FOLDER_NESTING_DEPTH = 7;

export type FolderNameValidationResult =
  | { valid: true; trimmedName: string }
  | { valid: false; message: string };

/**
 * Validates folder name after trim. Use the returned trimmedName when saving.
 */
export function validateFolderName(rawName: unknown): FolderNameValidationResult {
  if (rawName === null || rawName === undefined) {
    return { valid: false, message: "Folder name is required." };
  }

  const name = String(rawName).trim();

  if (name.length === 0) {
    return { valid: false, message: "Folder name is required." };
  }

  if (name.length > MAX_FOLDER_NAME_LENGTH) {
    return {
      valid: false,
      message: `Folder name must be at most ${MAX_FOLDER_NAME_LENGTH} characters.`,
    };
  }

  if (INVALID_FOLDER_NAME_CHARS.test(name)) {
    return {
      valid: false,
      message:
        'Folder names must not contain special characters (\\ / : * ? " < > |).',
    };
  }

  return { valid: true, trimmedName: name };
}

/**
 * Throws AppError if name is invalid; returns trimmed name if valid.
 */
export function assertValidFolderName(rawName: unknown): string {
  const result = validateFolderName(rawName);
  if (!result.valid) {
    throw new AppError(result.message, 400);
  }
  return result.trimmedName;
}

/**
 * Depth from project root: root-level folder (no path) = 1.
 */
export function getFolderDepth(folder: {
  path?: string | null;
}): number {
  const p = folder.path?.trim();
  if (!p) return 1;
  const segments = p.split(",").filter(Boolean);
  return segments.length + 1;
}

/**
 * Depth of a new folder that would be created under `parent`, or 1 if at project root.
 */
export function getNewFolderDepth(parent: {
  path?: string | null;
} | null): number {
  if (!parent) return 1;
  return getFolderDepth(parent) + 1;
}

export function assertFolderDepthWithinLimit(parent: {
  path?: string | null;
} | null): void {
  const newDepth = getNewFolderDepth(parent);
  if (newDepth > MAX_FOLDER_NESTING_DEPTH) {
    throw new AppError(
      `Maximum folder nesting depth (${MAX_FOLDER_NESTING_DEPTH} levels) has been reached.`,
      400,
    );
  }
}
