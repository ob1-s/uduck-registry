import fs from "node:fs";
import path from "node:path";
import type { Behavior } from "../../registry/schema/behavior";
import { ID_PATTERN, isAllowedArtifactUrl } from "../../registry/schema/allowlist";

export interface PullResult {
  destPath: string;
}

export function assertSafeArtifactFilename(filename: string): void {
  if (
    !filename ||
    path.isAbsolute(filename) ||
    path.basename(filename) !== filename ||
    path.posix.basename(filename) !== filename ||
    path.win32.basename(filename) !== filename ||
    filename.includes("/") ||
    filename.includes("\\") ||
    !filename.endsWith(".onnx")
  ) {
    throw new Error(`Refusing artifact filename '${filename}': expected a single .onnx filename`);
  }
}

export async function pullArtifact(behavior: Behavior, destDir: string): Promise<PullResult> {
  if (!ID_PATTERN.test(behavior.id)) {
    throw new Error(`Refusing to pull: behavior id '${behavior.id}' contains unsafe characters`);
  }

  const { filename, url } = behavior.artifacts.onnx;
  assertSafeArtifactFilename(filename);
  if (!isAllowedArtifactUrl(url)) {
    throw new Error(`Refusing to pull: artifact URL is not on the allowlist '${url}'`);
  }

  fs.mkdirSync(destDir, { recursive: true });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: HTTP ${response.status} for ${url}`);
  }

  const destPath = path.join(destDir, filename);
  fs.writeFileSync(destPath, new Uint8Array(await response.arrayBuffer()));
  return { destPath };
}
