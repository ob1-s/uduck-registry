import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Behavior } from "../../registry/schema/behavior";
import { ID_PATTERN } from "../../registry/schema/allowlist";

const VENDOR_DIR = path.resolve(process.cwd(), "vendor/policies");

export interface PullResult {
  source: "vendored" | "network";
  destPath: string;
  sha256: string;
  size_bytes: number;
  hashMatch: boolean | null; // null = no expected hash recorded (unverified)
}

/**
 * Pull a behavior's ONNX artifact, verifying integrity end-to-end.
 *
 * Prefer the vendored in-repo bytes (source of truth); fall back to downloading
 * from the canonical URL. Every byte read is hashed and checked against the
 * recorded sha256 + size_bytes before being trusted. Downloaded files are
 * written to a temp file and renamed only after verification succeeds.
 */
export async function pullArtifact(behavior: Behavior, destDir: string): Promise<PullResult> {
  const { sha256: expectedSha, size_bytes: expectedSize } = behavior.artifacts.onnx;

  // Defense-in-depth: the id is used in paths, so re-validate it here rather
  // than trusting the schema parse alone.
  if (!ID_PATTERN.test(behavior.id)) {
    throw new Error(`Refusing to pull: behavior id '${behavior.id}' contains unsafe characters`);
  }

  const filename = path.basename(behavior.artifacts.onnx.filename);
  if (filename !== behavior.artifacts.onnx.filename || filename.includes("/")) {
    throw new Error(`Refusing to pull: unsafe filename '${behavior.artifacts.onnx.filename}'`);
  }

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const destPath = path.join(destDir, filename);

  const vendorPath = path.join(VENDOR_DIR, `${behavior.id}.onnx`);
  if (fs.existsSync(vendorPath)) {
    const buf = fs.readFileSync(vendorPath);
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
    if (expectedSha && sha256 !== expectedSha) {
      throw new Error(
        `Vendored artifact for '${behavior.id}' failed hash check (expected ${expectedSha}, got ${sha256}). Registry bytes are compromised or stale — do not deploy.`,
      );
    }
    if (expectedSize != null && buf.length !== expectedSize) {
      throw new Error(`Vendored artifact size mismatch for '${behavior.id}'`);
    }
    fs.writeFileSync(destPath, buf);
    return { source: "vendored", destPath, sha256, size_bytes: buf.length, hashMatch: expectedSha ? true : null };
  }

  // Network fallback: stream to temp file, hash, verify, then atomically move.
  const url = behavior.artifacts.onnx.url;
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status} for ${url}`);
  }
  const tmpPath = destPath + ".part";
  const hash = crypto.createHash("sha256");
  let size = 0;
  const out = fs.createWriteStream(tmpPath);
  for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
    hash.update(chunk);
    size += chunk.length;
    out.write(chunk);
  }
  await new Promise<void>((resolve, reject) => {
    out.end(() => resolve());
    out.on("error", reject);
  });

  const sha256 = hash.digest("hex");
  if (expectedSha && sha256 !== expectedSha) {
    fs.rmSync(tmpPath, { force: true });
    throw new Error(
      `Hash mismatch for '${behavior.id}': expected ${expectedSha}, got ${sha256}. The upstream file changed or was tampered with. Nothing was written to ${destPath}.`,
    );
  }
  if (expectedSize != null && size !== expectedSize) {
    fs.rmSync(tmpPath, { force: true });
    throw new Error(`Size mismatch for '${behavior.id}': expected ${expectedSize}, got ${size}`);
  }
  fs.renameSync(tmpPath, destPath);
  return { source: "network", destPath, sha256, size_bytes: size, hashMatch: expectedSha ? true : null };
}
