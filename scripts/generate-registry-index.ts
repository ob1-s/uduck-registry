import fs from "node:fs";
import path from "node:path";
import { validateAllBehaviors } from "./validate-registry";
import { type CatalogEntry, type RegistryIndex } from "../registry/schema/catalog";
import { getCatalogEntries } from "../src/lib/registry";

const PUBLIC_DIR = path.resolve(process.cwd(), "public");
const REGISTRY_OUT = path.join(PUBLIC_DIR, "registry.json");
const README_PATH = path.resolve(process.cwd(), "README.md");
const FALLBACK_UPDATED_AT = "1970-01-01T00:00:00.000Z";
const README_TABLE_START = "<!-- BEGIN GENERATED BEHAVIOR TABLE -->";
const README_TABLE_END = "<!-- END GENERATED BEHAVIOR TABLE -->";

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

function formatLabel(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function mediaLabel(behavior: CatalogEntry): string {
  const labels = [
    behavior.media.registry?.loop_url && "registry loop",
    behavior.media.author.some((item) => item.type === "video") && "author video",
    behavior.media.author.some((item) => item.type === "image") && "author image",
  ].filter(Boolean);
  return labels.length > 0 ? labels.join(" + ") : "—";
}

export function renderReadmeCatalog(behaviors: CatalogEntry[]): string {
  const rows = behaviors.map((behavior) => {
    const authors = behavior.authors.map((author) => author.name).join(", ");
    const accessories = behavior.runtime.compatibility.accessories_required == null
      ? "unknown"
      : behavior.runtime.compatibility.accessories_required.length > 0
        ? behavior.runtime.compatibility.accessories_required.map(formatLabel).join(", ")
        : "none";

    return `| [${escapeTableCell(behavior.name)}](https://uduckmoves.com/behaviors/${behavior.id}) | \`${behavior.id}\` | ${escapeTableCell(formatLabel(behavior.category))} | ${formatLabel(behavior.hardware.status)} | ${escapeTableCell(authors)} | ${escapeTableCell(accessories)} | ${mediaLabel(behavior)} |`;
  });

  return [
    README_TABLE_START,
    "",
    "| Behavior | ID | Category | Status | Publisher | Setup | Preview |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    README_TABLE_END,
  ].join("\n");
}

export function updateReadmeCatalog(behaviors: CatalogEntry[], readmePath = README_PATH): void {
  const readme = fs.readFileSync(readmePath, "utf-8");
  const start = readme.indexOf(README_TABLE_START);
  const end = readme.indexOf(README_TABLE_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`README is missing the generated catalog markers: ${README_TABLE_START} / ${README_TABLE_END}`);
  }

  const before = readme.slice(0, start);
  const after = readme.slice(end + README_TABLE_END.length);
  fs.writeFileSync(readmePath, `${before}${renderReadmeCatalog(behaviors)}${after}`, "utf-8");
}

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
  const { valid, errors } = validateAllBehaviors();
  if (!valid) {
    throw new Error(`Cannot compile registry due to validation errors:\n${errors.join("\n")}`);
  }

  // The app loader and this compiler intentionally share the same boundary so
  // the API/site/index cannot drift into separate behavior and policy shapes.
  // It also attaches any trusted build evidence already present in the static
  // media directory.
  const entries = getCatalogEntries();
  const index: RegistryIndex = {
    version: "3.0.0",
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
