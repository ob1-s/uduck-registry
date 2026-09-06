import fs from "node:fs";
import path from "node:path";
import { validatePolicies } from "./validate-registry";
import { type RegistryIndex } from "../registry/schema/catalog";
import { getCatalogEntries } from "../src/lib/registry";

const PUBLIC_DIR = path.resolve(process.cwd(), "public");
const REGISTRY_OUT = path.join(PUBLIC_DIR, "registry.json");
const FALLBACK_UPDATED_AT = "1970-01-01T00:00:00.000Z";

/**
 * Keep snapshot generation byte-for-byte stable. Release automation may set
 * SOURCE_DATE_EPOCH when it intentionally wants to stamp a new index; local
 * and CI compiles otherwise retain the checked-in snapshot timestamp.
 */
export function getDeterministicUpdatedAt(
  outputPath = REGISTRY_OUT,
  sourceDateEpoch = process.env.SOURCE_DATE_EPOCH,
): string {
  if (sourceDateEpoch != null) {
    const seconds = Number(sourceDateEpoch);
    if (!Number.isSafeInteger(seconds) || seconds < 0) {
      throw new Error(`SOURCE_DATE_EPOCH must be a non-negative integer, got '${sourceDateEpoch}'`);
    }
    const date = new Date(seconds * 1000);
    if (Number.isNaN(date.getTime())) {
      throw new Error(`SOURCE_DATE_EPOCH is outside the supported date range: '${sourceDateEpoch}'`);
    }
    return date.toISOString();
  }

  try {
    const existing = JSON.parse(fs.readFileSync(outputPath, "utf-8"));
    if (typeof existing.updated_at === "string" && existing.updated_at.length > 0) {
      return existing.updated_at;
    }
  } catch {
    // A missing or malformed snapshot is handled by the stable epoch below.
  }

  return FALLBACK_UPDATED_AT;
}

export function generateRegistryIndex(): RegistryIndex {
  const { valid, errors } = validatePolicies();
  if (!valid) {
    throw new Error(`Cannot compile registry due to validation errors:\n${errors.join("\n")}`);
  }

  // The app loader and this compiler intentionally share the same boundary so
  // the API/site/index cannot drift into separate policy shapes.
  // It also attaches any trusted build evidence already present in the static
  // media directory.
  const entries = getCatalogEntries();
  const index: RegistryIndex = {
    version: "4.0.0",
    updated_at: getDeterministicUpdatedAt(),
    count: entries.length,
    entries,
  };

  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  fs.writeFileSync(REGISTRY_OUT, JSON.stringify(index, null, 2), "utf-8");

  console.log(`\x1b[32mSuccessfully compiled ${entries.length} catalog entries\x1b[0m`);
  return index;
}

if (process.argv[1]?.endsWith("generate-registry-index.ts")) {
  generateRegistryIndex();
}
