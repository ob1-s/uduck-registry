#!/usr/bin/env tsx
/**
 * Vendor canonical ONNX artifacts into the repo and backfill sha256 + size_bytes.
 *
 * Usage: pnpm tsx scripts/vendor-artifacts.ts
 *
 * For every behavior in registry/behaviors/*.json:
 *   1. downloads artifacts.onnx.url (must be on the host allowlist)
 *   2. writes the bytes to vendor/policies/<id>.onnx
 *   3. records sha256 + size_bytes into the behavior JSON
 *
 * Vendoring exists because hash-pinning a *mutable* URL (e.g. a Gradio Space
 * file) is false security; the bytes in-repo are the source of truth.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { HOST_ALLOWLIST } from "../registry/schema/allowlist";
import { BehaviorSchema } from "../registry/schema/behavior";

const BEHAVIORS_DIR = path.resolve(process.cwd(), "registry/behaviors");
const VENDOR_DIR = path.resolve(process.cwd(), "vendor/policies");

async function main() {
  fs.mkdirSync(VENDOR_DIR, { recursive: true });
  const files = fs.readdirSync(BEHAVIORS_DIR).filter((f) => f.endsWith(".json"));
  const manifest: Record<string, { sha256: string; size_bytes: number; url: string }> = {};

  for (const file of files) {
    const fullPath = path.join(BEHAVIORS_DIR, file);
    const raw = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    const b = raw;
    const urlStr: string | undefined = b?.artifacts?.onnx?.url;
    if (!urlStr) {
      console.error(`Skipping ${file}: no artifacts.onnx.url`);
      continue;
    }
    const url = new URL(urlStr);
    if (url.protocol !== "https:" || !HOST_ALLOWLIST.includes(url.hostname)) {
      console.error(`Skipping ${b.id}: URL host not on allowlist (${url.hostname})`);
      continue;
    }

    const outPath = path.join(VENDOR_DIR, `${b.id}.onnx`);
    if (fs.existsSync(outPath) && b.artifacts.onnx.sha256) {
      console.log(`Already vendored: ${b.id} (use --force to re-download)`);
      manifest[b.id] = {
        sha256: b.artifacts.onnx.sha256,
        size_bytes: b.artifacts.onnx.size_bytes,
        url: b.artifacts.onnx.url,
      };
      continue;
    }

    console.log(`Fetching ${b.id} <- ${url}`);
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) {
      console.error(`  FAILED: HTTP ${res.status}`);
      process.exitCode = 1;
      continue;
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const sha256 = crypto.createHash("sha256").update(buf).digest("hex");
    fs.writeFileSync(outPath, buf);
    manifest[b.id] = { sha256, size_bytes: buf.length, url: b.artifacts.onnx.url };
    console.log(`  vendored ${buf.length} bytes  sha256=${sha256}`);

    // Backfill the behavior JSON (preserve 2-space formatting).
    const rawJson = JSON.parse(fs.readFileSync(fullPath, "utf-8"));
    rawJson.artifacts.onnx.sha256 = sha256;
    rawJson.artifacts.onnx.size_bytes = buf.length;
    fs.writeFileSync(fullPath, JSON.stringify(rawJson, null, 2) + "\n", "utf-8");
  }

  fs.writeFileSync(
    path.join(VENDOR_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
    "utf-8",
  );
  console.log(`\nVendored ${Object.keys(manifest).length}/${files.length} artifacts.`);
}

const force = process.argv.includes("--force");
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
