import path from "path";
import type { FileTypeResult } from "file-type";
import { AppError } from "../../../utils/AppError";

/** Max upload size (bytes) — aligned with Explorer rules */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** Max full filename length (base + extension), after sanitize */
export const MAX_FILENAME_LENGTH = 150;

/** Allowed extensions (lowercase), aligned with BIM CDE viewer rules */
export const ALLOWED_EXTENSIONS = new Set([
  "ifc",
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "doc",
  "docx",
  "docs",
]);

const DANGEROUS_EXTS = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "msi",
  "sh",
  "ps1",
  "vbs",
  "js",
  "jar",
  "app",
  "deb",
  "rpm",
]);

const DANGEROUS_MIME_SNIPPETS = [
  "application/x-msdownload",
  "application/x-dosexec",
  "application/x-msdos-program",
  "application/x-executable",
  "application/x-sh",
  "text/x-shellscript",
];

/** MIME detected from file content must be compatible with this extension */
const EXT_ALLOWED_MIMES: Record<string, string[]> = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  webp: ["image/webp"],
  doc: ["application/msword"],
  docx: [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  docs: [
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ],
  ifc: [
    "application/octet-stream",
    "application/ifc",
    "model/ifc",
    "application/zip",
    "text/plain",
  ],
};

export function getExtensionFromName(fileName: string): string {
  const ext = path.extname(fileName).replace(/^\./, "").toLowerCase();
  return ext;
}

/**
 * Remove risky characters; collapse whitespace; cap total length (name + ext).
 */
export function sanitizeUploadFileName(original: string): string {
  const base = path.basename(original);
  const extRaw = path.extname(base);
  let stem = base.slice(0, -extRaw.length);
  stem = stem
    .replace(/[^\p{L}\p{N}\s.\-_]/gu, "_")
    .replace(/\s+/g, " ")
    .trim();
  if (!stem) stem = "file";
  const ext = extRaw.toLowerCase();
  let full = `${stem}${ext}`;
  if (full.length > MAX_FILENAME_LENGTH) {
    const maxStem = Math.max(1, MAX_FILENAME_LENGTH - ext.length);
    full = `${stem.slice(0, maxStem)}${ext}`;
  }
  return full;
}

function isMimeDangerous(mime: string): boolean {
  const m = mime.toLowerCase().split(";")[0].trim();
  if (DANGEROUS_MIME_SNIPPETS.some((d) => m.includes(d))) return true;
  if (m === "application/java-archive") return true;
  return false;
}

function mimeMatchesExtension(ext: string, detectedMime: string): boolean {
  const allowed = EXT_ALLOWED_MIMES[ext];
  if (!allowed) return false;
  const m = detectedMime.toLowerCase().split(";")[0].trim();
  return allowed.some((a) => a === m);
}

/**
 * Validates declared extension + content sniffing. Throws AppError on failure.
 */
export function validateUploadedFileContent(
  sanitizedFileName: string,
  detected: FileTypeResult | undefined,
): { ext: string; mimeType: string } {
  const ext = getExtensionFromName(sanitizedFileName);
  if (!ext || !ALLOWED_EXTENSIONS.has(ext)) {
    throw new AppError(
      `File type ".${ext || "?"}" is not allowed. Allowed: ${[...ALLOWED_EXTENSIONS].join(", ")}`,
      400,
    );
  }

  if (DANGEROUS_EXTS.has(ext)) {
    throw new AppError("This file type is blocked for security reasons.", 400);
  }

  if (detected) {
    if (DANGEROUS_EXTS.has(detected.ext)) {
      throw new AppError("Executable or script content is not allowed.", 400);
    }
    if (isMimeDangerous(detected.mime)) {
      throw new AppError("This file type is blocked for security reasons.", 400);
    }
    if (!mimeMatchesExtension(ext, detected.mime)) {
      throw new AppError(
        "File content does not match the allowed type for this extension.",
        400,
      );
    }
    return { ext, mimeType: detected.mime };
  }

  // Unknown magic bytes: only IFC is accepted (common for STEP/IFC binaries)
  if (ext === "ifc") {
    return { ext, mimeType: "application/octet-stream" };
  }

  throw new AppError(
    "Could not verify file content. The file may be corrupted or disguised.",
    400,
  );
}

export type ConflictStrategy = "version" | "copy";

export function parseConflictStrategy(raw: unknown): ConflictStrategy {
  if (raw === "copy") return "copy";
  return "version";
}
