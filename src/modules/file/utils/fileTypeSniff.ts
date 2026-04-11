import type { FileTypeResult } from "file-type";

type FileTypeModule = {
  fileTypeFromFile?: (p: string) => Promise<FileTypeResult | undefined>;
  fromFile?: (p: string) => Promise<FileTypeResult | undefined>;
  default?: FileTypeModule;
};

/**
 * `file-type` v18+ is ESM-only. With `module: "commonjs"`, a static import can
 * mis-resolve; use a real runtime dynamic import for ts-node / compiled JS.
 *
 * v16.x exposes `fromFile`; v17+ often uses `fileTypeFromFile`. Support both.
 */
export async function fileTypeFromFilePath(
  filePath: string,
): Promise<FileTypeResult | undefined> {
  const dynamicImport = new Function(
    "return import('file-type')",
  ) as () => Promise<FileTypeModule>;
  const raw = await dynamicImport();
  const mod: FileTypeModule = raw?.default ?? raw;
  const sniff =
    typeof mod.fileTypeFromFile === "function"
      ? mod.fileTypeFromFile
      : typeof mod.fromFile === "function"
        ? mod.fromFile
        : undefined;
  if (!sniff) {
    throw new Error(
      "file-type: expected fileTypeFromFile or fromFile (check package version)",
    );
  }
  return sniff(filePath);
}
