import type { FileTypeResult } from "file-type";

/**
 * `file-type` v18+ is ESM-only. With `module: "commonjs"`, TypeScript compiles
 * `await import("file-type")` to `require("file-type")`, which crashes.
 * This keeps a real runtime dynamic import that ts-node can execute.
 */
export async function fileTypeFromFilePath(
  filePath: string,
): Promise<FileTypeResult | undefined> {
  const dynamicImport = new Function(
    "return import('file-type')",
  ) as () => Promise<{ fileTypeFromFile: (p: string) => Promise<FileTypeResult | undefined> }>;
  const { fileTypeFromFile } = await dynamicImport();
  return fileTypeFromFile(filePath);
}
