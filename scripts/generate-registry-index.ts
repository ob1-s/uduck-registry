import fs from "node:fs";
import path from "node:path";
import { validatePolicies } from "./validate-registry";
import { type CatalogEntry, type RegistryIndex } from "../registry/schema/catalog";
import { getCatalogEntries } from "../src/lib/registry";

const PUBLIC_DIR = path.resolve(process.cwd(), "public");
const REGISTRY_OUT = path.join(PUBLIC_DIR, "registry.json");
const README_PATH = path.resolve(process.cwd(), "README.md");
const FALLBACK_UPDATED_AT = "1970-01-01T00:00:00.000Z";
const README_TABLE_START = "<!-- BEGIN GENERATED CATALOG TABLE -->";
const README_TABLE_END = "<!-- END GENERATED CATALOG TABLE -->";

function escapeTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replace(/\r?\n/g, " ");
}

function formatLabel(value: string): string {
  return value.replaceAll("_", " ").replaceAll("-", " ");
}

function mediaLabel(entry: CatalogEntry): string {
  const labels = [
    entry.media.registry?.loop_url && "registry loop",
    entry.media.author.some((item) => item.type === "video") && "author video",
    entry.media.author.some((item) => item.type === "image") && "author image",
  ].filter(Boolean);
  return labels.length > 0 ? labels.join(" + ") : "—";
}

export function renderReadmeCatalog(entries: CatalogEntry[]): string {
  const rows = entries.map((entry) => {
    const authors = entry.authors.map((author) => author.name).join(", ");
    const accessories = entry.runtime.compatibility.accessories_required == null
      ? "unknown"
      : entry.runtime.compatibility.accessories_required.length > 0
        ? entry.runtime.compatibility.accessories_required.map(formatLabel).join(", ")
        : "none";

    return `| [${escapeTableCell(entry.name)}](https://uduckmoves.com/behaviors/${entry.id}) | \`${entry.id}\` | ${escapeTableCell(formatLabel(entry.category))} | ${formatLabel(entry.hardware.status)} | ${escapeTableCell(authors)} | ${escapeTableCell(accessories)} | ${mediaLabel(entry)} |`;
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

export function updateReadmeCatalog(entries: CatalogEntry[], readmePath = README_PATH): void {
  const readme = fs.readFileSync(readmePath, "utf-8");
  const start = readme.indexOf(README_TABLE_START);
  const end = readme.indexOf(README_TABLE_END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`README is missing the generated catalog markers: ${README_TABLE_START} / ${README_TABLE_END}`);
  }

  const before = readme.slice(0, start);
  const after = readme.slice(end + README_TABLE_END.length);
  fs.writeFileSync(readmePath, `${before}${renderReadmeCatalog(entries)}${after}`, "utf-8");
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
