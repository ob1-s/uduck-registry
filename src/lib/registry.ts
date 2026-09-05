import fs from "node:fs";
import path from "node:path";
import { BehaviorSchema, type Behavior } from "@registry/schema/behavior";
import {
  catalogEntriesFromSources,
  type CatalogEntry,
  type CatalogSimulationEvidence,
} from "@registry/schema/catalog";
import { getPolicies } from "./policies";

const BEHAVIORS_DIR = path.resolve(process.cwd(), "registry/behaviors");
const REGISTRY_MEDIA_DIR = path.resolve(process.cwd(), "public/media/registry-sim");

/** Read the manually authored input records. Consumers should use
 * getCatalogEntries(), which normalizes these with resolved Hub packages. */
export function getAllBehaviors(): Behavior[] {
  if (!fs.existsSync(BEHAVIORS_DIR)) return [];

  const behaviors: Behavior[] = [];
  for (const file of fs.readdirSync(BEHAVIORS_DIR).filter((name) => name.endsWith(".json")).sort()) {
    try {
      const parsed = BehaviorSchema.safeParse(
        JSON.parse(fs.readFileSync(path.join(BEHAVIORS_DIR, file), "utf-8")),
      );
      if (parsed.success) {
        behaviors.push(parsed.data);
      } else {
        console.error(`Invalid behavior schema in ${file}:`, parsed.error.format());
      }
    } catch (error) {
      console.error(`Failed to read ${file}:`, error);
    }
  }

  return behaviors.sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

function readEvidence(id: string): CatalogSimulationEvidence | null {
  const directory = path.join(REGISTRY_MEDIA_DIR, id);
  const reportPath = path.join(directory, "report.json");
  if (!fs.existsSync(reportPath)) return null;

  try {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8")) as Record<string, unknown>;
    const execution = report.execution;
    // Fail closed: a rendered report without an explicit checks_status,
    // identity, and checks never becomes "passed".
    let status: CatalogSimulationEvidence["status"];
    if (execution === "rendered") {
      if (report.checks_status !== "passed" && report.checks_status !== "failed") return null;
      status = report.checks_status;
      if (typeof report.evidence_key !== "string" || !/^[a-f0-9]{64}$/.test(report.evidence_key)) return null;
      if (typeof report.inputs_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(report.inputs_sha256)) return null;
      const recipe = report.recipe as Record<string, unknown> | undefined;
      if (!recipe || typeof recipe.runner !== "string" || typeof recipe.scenario !== "string") return null;
      if (!Array.isArray(report.checks) || report.checks.length === 0) return null;
    } else if (execution === "unsupported") {
      status = "not-covered";
    } else if (execution === "rejected" || execution === "failed") {
      status = "failed";
    } else {
      return null;
    }
    const recipe = report.recipe && typeof report.recipe === "object" && !Array.isArray(report.recipe)
      ? report.recipe as Record<string, unknown>
      : {};
    const media = report.media && typeof report.media === "object" && !Array.isArray(report.media)
      ? report.media as Record<string, unknown>
      : {};
    const checks = Array.isArray(report.checks)
      ? report.checks.filter((check): check is { check: string; passed: boolean; detail: string } => (
        Boolean(check) && typeof check === "object" && !Array.isArray(check)
        && typeof (check as Record<string, unknown>).check === "string"
        && typeof (check as Record<string, unknown>).passed === "boolean"
        && typeof (check as Record<string, unknown>).detail === "string"
      ))
      : [];
    // Rendered evidence requires checks; report-only (unsupported) may have none.
    if (execution === "rendered" && checks.length === 0) return null;
    const localLoop = path.join(directory, "loop.mp4");
    const localPoster = path.join(directory, "poster.png");
    return {
      status,
      evidence_key: typeof report.evidence_key === "string" ? report.evidence_key : null,
      inputs_sha256: typeof report.inputs_sha256 === "string" ? report.inputs_sha256 : null,
      runner: typeof recipe.runner === "string" ? recipe.runner : null,
      scene: typeof recipe.scene === "string" ? recipe.scene : null,
      scenario: typeof recipe.scenario === "string" ? recipe.scenario : null,
      report_url: `/media/registry-sim/${id}/report.json`,
      loop_url: fs.existsSync(localLoop)
        ? `/media/registry-sim/${id}/loop.mp4`
        : typeof media.loop_url === "string" ? media.loop_url : null,
      poster_url: fs.existsSync(localPoster)
        ? `/media/registry-sim/${id}/poster.png`
        : typeof media.poster_url === "string" ? media.poster_url : null,
      checks,
      reason: typeof report.reason === "string"
        ? report.reason
        : typeof report.notes === "string" ? report.notes : null,
    };
  } catch (error) {
    console.error(`Failed to read registry evidence for ${id}:`, error);
    return null;
  }
}

/** The single public catalog consumed by pages, APIs, and index generation. */
export function getCatalogEntries(): CatalogEntry[] {
  const behaviors = getAllBehaviors();
  const policies = getPolicies();
  const evidence = new Map<string, CatalogSimulationEvidence>();
  for (const entry of [...behaviors, ...policies]) {
    const result = readEvidence(entry.id);
    if (result) evidence.set(entry.id, result);
  }
  return catalogEntriesFromSources(behaviors, policies, evidence);
}

export function getCatalogEntryById(id: string): CatalogEntry | null {
  return getCatalogEntries().find((entry) => entry.id === id) ?? null;
}

export function getRegistryStats() {
  const entries = getCatalogEntries();
  return {
    total: entries.length,
    hardware: entries.filter((entry) => entry.hardware.status === "maintainer-verified").length,
    community: entries.filter((entry) => entry.runtime.classification === "custom" || entry.category === "experimental").length,
  };
}

