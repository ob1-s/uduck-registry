import fs from "node:fs";
import path from "node:path";
import {
  catalogEntries,
  type CatalogEntry,
  type CatalogSimulationEvidence,
} from "@registry/schema/catalog";
import type { Policy } from "@registry/schema/policy";
import { getResolvedPolicies } from "./policies";

const REGISTRY_MEDIA_DIR = path.resolve(process.cwd(), "public/media/registry-sim");

function sameSource(report: unknown, policy: Policy): boolean {
  if (!report || typeof report !== "object" || Array.isArray(report)) return false;
  const source = report as Record<string, unknown>;
  return ["provider", "repo", "revision", "artifact_path", "artifact_sha256", "manifest_path", "manifest_sha256"]
    .every((key) => source[key] === policy.source[key as keyof Policy["source"]]);
}

function readEvidence(id: string, policy: Policy): CatalogSimulationEvidence | null {
  const directory = path.join(REGISTRY_MEDIA_DIR, id);
  const reportPath = path.join(directory, "report.json");
  if (!fs.existsSync(reportPath)) return null;

  try {
    const report = JSON.parse(fs.readFileSync(reportPath, "utf-8")) as Record<string, unknown>;
    if (report.entry !== id || !sameSource(report.source, policy)) return null;
    const reportPolicy = report.policy;
    const inputs = report.inputs_sha256;
    const artifact = policy.source.artifact_sha256;
    if (!reportPolicy || typeof reportPolicy !== "object" || Array.isArray(reportPolicy)
      || (reportPolicy as Record<string, unknown>).sha256 !== artifact
      || typeof inputs !== "string" || !/^[a-f0-9]{64}$/.test(inputs)
      || typeof report.evidence_key !== "string" || !/^[a-f0-9]{64}$/.test(report.evidence_key)) return null;
    // The Python runner and evidence store are the single canonical identity
    // implementation. Hydration verifies the digest and key before this
    // website-facing reader sees the report; TypeScript only enforces the
    // source binding and report shape here, avoiding a second implementation.
    const execution = report.execution;
    let status: CatalogSimulationEvidence["status"];
    if (execution === "rendered") {
      if (report.checks_status !== "passed" && report.checks_status !== "failed") return null;
      if (typeof report.evidence_key !== "string" || !/^[a-f0-9]{64}$/.test(report.evidence_key)) return null;
      if (typeof report.inputs_sha256 !== "string" || !/^[a-f0-9]{64}$/.test(report.inputs_sha256)) return null;
      const recipe = report.recipe as Record<string, unknown> | undefined;
      if (!recipe || typeof recipe.runner !== "string" || typeof recipe.scenario !== "string") return null;
      if (!Array.isArray(report.checks) || report.checks.length === 0) return null;
      status = report.checks_status;
    } else if (execution === "not-covered") {
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
      loop_url: fs.existsSync(localLoop) ? `/media/registry-sim/${id}/loop.mp4` : typeof media.loop_url === "string" ? media.loop_url : null,
      poster_url: fs.existsSync(localPoster) ? `/media/registry-sim/${id}/poster.png` : typeof media.poster_url === "string" ? media.poster_url : null,
      checks,
      reason: typeof report.reason === "string" ? report.reason : typeof report.notes === "string" ? report.notes : null,
    };
  } catch (error) {
    console.error(`Failed to read registry evidence for ${id}:`, error);
    return null;
  }
}

/** The only public catalog consumed by pages, APIs, and index generation. */
export function getCatalogEntries(): CatalogEntry[] {
  const policies = getResolvedPolicies();
  const evidence = new Map<string, CatalogSimulationEvidence>();
  for (const policy of policies) {
    const result = readEvidence(policy.id, policy);
    if (result) evidence.set(policy.id, result);
  }
  return catalogEntries(policies, evidence);
}

export function getCatalogEntryById(id: string): CatalogEntry | null {
  return getCatalogEntries().find((entry) => entry.id === id) ?? null;
}

export function getRegistryStats() {
  const entries = getCatalogEntries();
  return {
    total: entries.length,
    hardware: entries.filter((entry) => entry.hardware.status === "maintainer-verified").length,
    community: entries.filter((entry) => entry.category === "experimental").length,
  };
}
