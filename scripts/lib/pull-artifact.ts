import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { Behavior } from "../../registry/schema/behavior";
import { ID_PATTERN, isAllowedArtifactUrl } from "../../registry/schema/allowlist";

const VENDOR_DIR = path.resolve(process.cwd(), "vendor/policies");
const SHA256_PATTERN = /^[a-f0-9]{64}$/;

function assertExpectedSha256(expectedSha?: string, label = "artifact"): void {
  if (expectedSha != null && !SHA256_PATTERN.test(expectedSha)) {
    throw new Error(`${label} has an invalid expected sha256 '${expectedSha}'`);
  }
}

export interface PullResult {
  source: "vendored" | "network";
  destPath: string;
  sha256: string;
  size_bytes: number;
  hashMatch: boolean | null; // null = no expected hash recorded (unverified)
}

/**
 * Artifact filenames are written below a caller-provided directory. Keep the
 * accepted value a single, relative ONNX filename on both POSIX and Windows.
 */
export function assertSafeArtifactFilename(filename: string): void {
  if (
    !filename ||
    filename === "." ||
    filename === ".." ||
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

/** Reject a redirect whose final URL leaves the canonical artifact allowlist. */
export function assertAllowedArtifactResponse(response: Response, requestedUrl: string): string {
  const finalUrl = response.url || requestedUrl;
  if (!isAllowedArtifactUrl(finalUrl)) {
    throw new Error(
      `Refusing artifact response: '${requestedUrl}' redirected to disallowed URL '${finalUrl}'`,
    );
  }
  return finalUrl;
}

/** Hash bytes and enforce the metadata checks already used by the registry. */
export function verifyArtifactBytes(
  bytes: Uint8Array,
  expectedSha?: string,
  expectedSize?: number,
  label = "artifact",
): { sha256: string; size_bytes: number } {
  assertExpectedSha256(expectedSha, label);

  const size_bytes = bytes.byteLength;
  if (expectedSize != null && size_bytes !== expectedSize) {
    throw new Error(`${label} size mismatch: expected ${expectedSize}, got ${size_bytes}`);
  }

  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  if (expectedSha != null && sha256 !== expectedSha) {
    throw new Error(`${label} sha256 hash mismatch: expected ${expectedSha}, got ${sha256}`);
  }

  return { sha256, size_bytes };
}

/** Write only complete, verified bytes to the destination path. */
export function writeFileAtomically(destPath: string, bytes: Uint8Array): void {
  const tmpPath = `${destPath}.part-${process.pid}-${crypto.randomUUID()}`;
  try {
    fs.writeFileSync(tmpPath, bytes, { flag: "wx" });
    fs.renameSync(tmpPath, destPath);
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
}

function makePartPath(destPath: string): string {
  return `${destPath}.part-${process.pid}-${crypto.randomUUID()}`;
}

async function streamResponseToFile(
  response: Response,
  tmpPath: string,
): Promise<{ sha256: string; size_bytes: number }> {
  if (!response.body) {
    throw new Error("Artifact response did not contain a body");
  }

  const hash = crypto.createHash("sha256");
  let size_bytes = 0;
  const hashing = new Transform({
    transform(chunk: Buffer | Uint8Array, _encoding, callback) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      hash.update(bytes);
      size_bytes += bytes.length;
      callback(null, bytes);
    },
  });

  try {
    await pipeline(
      Readable.from(response.body as unknown as AsyncIterable<Uint8Array>),
      hashing,
      fs.createWriteStream(tmpPath, { flags: "wx" }),
    );
  } catch (error) {
    fs.rmSync(tmpPath, { force: true });
    throw error;
  }

  return { sha256: hash.digest("hex"), size_bytes };
}

/**
 * Pull a behavior's ONNX artifact, verifying integrity end-to-end.
 *
 * Prefer the optional local cache; fall back to downloading from the canonical
 * URL. Every byte read is hashed and checked against the
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

  const filename = behavior.artifacts.onnx.filename;
  assertSafeArtifactFilename(filename);

  const url = behavior.artifacts.onnx.url;
  if (!isAllowedArtifactUrl(url)) {
    throw new Error(`Refusing to pull: artifact URL is not on the allowlist '${url}'`);
  }
  assertExpectedSha256(expectedSha, `Artifact '${behavior.id}'`);

  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  const destPath = path.join(destDir, filename);

  const vendorPath = path.join(VENDOR_DIR, `${behavior.id}.onnx`);
  if (fs.existsSync(vendorPath)) {
    const buf = fs.readFileSync(vendorPath);
    const digest = verifyArtifactBytes(
      buf,
      expectedSha,
      expectedSize,
      `Vendored artifact for '${behavior.id}'`,
    );
    writeFileAtomically(destPath, buf);
    return {
      source: "vendored",
      destPath,
      sha256: digest.sha256,
      size_bytes: digest.size_bytes,
      hashMatch: expectedSha ? true : null,
    };
  }

  // Network fallback: stream to temp file, hash, verify, then atomically move.
  const res = await fetch(url, { redirect: "follow" });
  assertAllowedArtifactResponse(res, url);
  if (!res.ok) {
    throw new Error(`Download failed: HTTP ${res.status} for ${url}`);
  }

  const tmpPath = makePartPath(destPath);
  try {
    const streamed = await streamResponseToFile(res, tmpPath);
    // `streamResponseToFile` already hashed the stream. Reuse its digest while
    // enforcing the recorded metadata without buffering the download again.
    if (expectedSize != null && streamed.size_bytes !== expectedSize) {
      throw new Error(`Artifact '${behavior.id}' size mismatch: expected ${expectedSize}, got ${streamed.size_bytes}`);
    }
    if (expectedSha != null && streamed.sha256 !== expectedSha) {
      throw new Error(
        `Artifact '${behavior.id}' sha256 mismatch: expected ${expectedSha}, got ${streamed.sha256}`,
      );
    }
    fs.renameSync(tmpPath, destPath);
    return {
      source: "network",
      destPath,
      sha256: streamed.sha256,
      size_bytes: streamed.size_bytes,
      hashMatch: expectedSha ? true : null,
    };
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
}
