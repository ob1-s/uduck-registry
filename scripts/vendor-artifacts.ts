#!/usr/bin/env tsx
/**
 * Cache canonical ONNX artifacts locally and backfill sha256 + size_bytes.
 *
 * Usage: pnpm tsx scripts/vendor-artifacts.ts [--force]
 *
 * For every discoverable behavior in registry/behaviors/*.json:
 *   1. downloads artifacts.onnx.url (must be on the host allowlist)
 *   2. writes the bytes to the local cache at vendor/policies/<id>.onnx
 *   3. records sha256 + size_bytes into the behavior JSON
 *
 * The descriptor metadata remains the portable source of truth. The cache is
 * useful for offline work and simulation, but it is not required in a clone.
 */
import fs from "node:fs";
import path from "node:path";
import { isAllowedArtifactUrl } from "../registry/schema/allowlist";
import { BehaviorSchema, isDiscoverableBehavior } from "../registry/schema/behavior";
import {
  assertAllowedArtifactResponse,
  assertSafeArtifactFilename,
  verifyArtifactBytes,
  writeFileAtomically,
} from "./lib/pull-artifact";

export interface VendorOptions {
  cwd?: string;
  force?: boolean;
}

export interface VendorResult {
  total: number;
  vendored: number;
  failed: number;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function updateArtifactMetadata(raw: any, sha256: string, size_bytes: number): void {
  raw.artifacts.onnx.sha256 = sha256;
  raw.artifacts.onnx.size_bytes = size_bytes;
}

export async function vendorArtifacts({ cwd = process.cwd(), force = false }: VendorOptions = {}): Promise<VendorResult> {
  const behaviorsDir = path.resolve(cwd, "registry/behaviors");
  const vendorDir = path.resolve(cwd, "vendor/policies");

  fs.mkdirSync(vendorDir, { recursive: true });
  const files = fs.readdirSync(behaviorsDir).filter((f) => f.endsWith(".json")).sort();
  let failed = 0;
  let vendored = 0;

  for (const file of files) {
    const fullPath = path.join(behaviorsDir, file);
    let raw: any;
    try {
      raw = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    } catch (err) {
      console.error(`Skipping ${file}: ${errorMessage(err)}`);
      failed += 1;
      continue;
    }

    const parsed = BehaviorSchema.safeParse(raw);
    if (!parsed.success) {
      console.error(`Skipping ${file}: schema validation failed`);
      failed += 1;
      continue;
    }

    const behavior = parsed.data;
    if (!isDiscoverableBehavior(behavior)) {
      console.log(`Skipping ${behavior.id}: source-only record has no listed artifact`);
      continue;
    }
    const onnx = behavior.artifacts.onnx;
    if (behavior.verification.status === "community_experimental" && !onnx.sha256) {
      console.log(`Skipping ${behavior.id}: community artifact is not pinned`);
      continue;
    }
    try {
      assertSafeArtifactFilename(onnx.filename);
    } catch (err) {
      console.error(`Skipping ${file}: ${errorMessage(err)}`);
      failed += 1;
      continue;
    }

    if (!isAllowedArtifactUrl(onnx.url)) {
      console.error(`Skipping ${behavior.id}: URL host not on allowlist (${onnx.url})`);
      failed += 1;
      continue;
    }

    const outPath = path.join(vendorDir, `${behavior.id}.onnx`);
    if (fs.existsSync(outPath) && onnx.sha256 && !force) {
      try {
        const bytes = fs.readFileSync(outPath);
        const digest = verifyArtifactBytes(
          bytes,
          onnx.sha256,
          onnx.size_bytes,
          `Existing artifact for '${behavior.id}'`,
        );
        if (onnx.size_bytes == null) {
          updateArtifactMetadata(raw, digest.sha256, digest.size_bytes);
          fs.writeFileSync(fullPath, JSON.stringify(raw, null, 2) + "\n", "utf-8");
        }
        vendored += 1;
        console.log(`Already vendored: ${behavior.id}${onnx.size_bytes == null ? " (backfilled size)" : ""}`);
        continue;
      } catch (err) {
        console.error(`FAILED: existing artifact for '${behavior.id}' is invalid: ${errorMessage(err)} (use --force to re-download)`);
        failed += 1;
        continue;
      }
    }

    try {
      console.log(`Fetching ${behavior.id} <- ${onnx.url}`);
      const res = await fetch(onnx.url, { redirect: "follow" });
      assertAllowedArtifactResponse(res, onnx.url);
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const bytes = Buffer.from(await res.arrayBuffer());
      const digest = verifyArtifactBytes(bytes, undefined, undefined, `Downloaded artifact for '${behavior.id}'`);
      writeFileAtomically(outPath, bytes);
      updateArtifactMetadata(raw, digest.sha256, digest.size_bytes);
      fs.writeFileSync(fullPath, JSON.stringify(raw, null, 2) + "\n", "utf-8");

      vendored += 1;
      console.log(`  vendored ${digest.size_bytes} bytes  sha256=${digest.sha256}`);
    } catch (err) {
      console.error(`  FAILED: ${errorMessage(err)}`);
      failed += 1;
    }
  }

  console.log(`\nVendored ${vendored}/${files.length} artifacts${failed ? ` (${failed} failed)` : ""}.`);
  return { total: files.length, vendored, failed };
}

async function main() {
  const result = await vendorArtifacts({ force: process.argv.includes("--force") });
  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("vendor-artifacts.ts")) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
