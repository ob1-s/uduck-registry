#!/usr/bin/env tsx
import fs from "node:fs";
import { BehaviorSchema } from "../registry/schema/behavior";

/**
 * Draft/preflight checker for behavior descriptors.
 *
 * Preflight is a lint for descriptor drafts and candidate files: it reports
 * which required fields are still unresolved and which present values fail
 * the canonical schema. It is advisory — it never writes files and never
 * gates anything. The only path into registry/behaviors/ is
 * a reviewed, complete descriptor, and `pnpm validate` remains the sole
 * gate for published entries. One schema, no "kind of valid" descriptors.
 */

export interface PreflightFinding {
  kind: "unresolved" | "invalid";
  path: string;
  reason: string;
}

export interface PreflightResult {
  findings: PreflightFinding[];
  notes: string[];
  complete: boolean;
}

const ROOT = "<root>";

const UNRESOLVED_REASON =
  "no value provided; must come from an authoritative source (policy manifest, upstream repo, or direct measurement)";

function formatPath(path: readonly PropertyKey[]): string {
  if (path.length === 0) return ROOT;
  return path.map((segment) => String(segment)).join(".");
}

/** True when the candidate object actually carries a value at this path. */
function hasValueAt(raw: unknown, path: readonly PropertyKey[]): boolean {
  let current: unknown = raw;
  for (const segment of path) {
    if (current === null || typeof current !== "object") return false;
    current = (current as Record<PropertyKey, unknown>)[segment];
  }
  return current !== undefined && current !== null;
}

/**
 * Verification notes describe the hardware-evidence axis only. Registry
 * simulation is a separate axis derived from committed evidence; preflight
 * never mentions sim results and never lets them touch verification.status.
 */
function verificationNotes(raw: unknown): string[] {
  const status = (raw as { verification?: { status?: unknown } } | null)?.verification?.status;
  switch (status) {
    case "community_experimental":
      return ["verification.status = community_experimental — no hardware evidence claimed"];
    case "claimed_hardware":
      return ["verification.status = claimed_hardware — hardware claim requires human review"];
    case "verified_hardware":
      return ["verification.status = verified_hardware — hardware evidence requires human review"];
    default:
      return [];
  }
}

export function preflightDescriptor(raw: unknown): PreflightResult {
  const result = BehaviorSchema.safeParse(raw);
  if (result.success) {
    return { findings: [], notes: verificationNotes(raw), complete: true };
  }

  // Absent required fields are "unresolved"; present-but-wrong values (and
  // unrecognized keys) are "invalid". Classification reads the candidate
  // object itself, so it stays stable across zod message changes.
  const findings: PreflightFinding[] = result.error.issues.map((issue) => {
    const pathKey = formatPath(issue.path);
    if (hasValueAt(raw, issue.path)) {
      return { kind: "invalid", path: pathKey, reason: issue.message };
    }
    return { kind: "unresolved", path: pathKey, reason: UNRESOLVED_REASON };
  });

  findings.sort((a, b) =>
    a.kind === b.kind ? a.path.localeCompare(b.path) : a.kind === "invalid" ? -1 : 1,
  );

  return { findings, notes: verificationNotes(raw), complete: false };
}

export function formatPreflight(result: PreflightResult): string {
  const lines: string[] = [];
  for (const finding of result.findings) {
    lines.push(`${finding.kind}: ${finding.path} — ${finding.reason}`);
  }
  for (const note of result.notes) {
    lines.push(`note: ${note}`);
  }
  const unresolved = result.findings.filter((f) => f.kind === "unresolved").length;
  const invalid = result.findings.filter((f) => f.kind === "invalid").length;
  lines.push(`status: ${result.complete ? "complete" : "incomplete"} (${unresolved} unresolved, ${invalid} invalid)`);
  return lines.join("\n");
}

export function preflightFile(filePath: string): PreflightResult {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return {
      findings: [{ kind: "invalid", path: ROOT, reason: `file is not valid JSON: ${reason}` }],
      notes: [],
      complete: false,
    };
  }
  return preflightDescriptor(raw);
}

export function main(argv = process.argv.slice(2)): number {
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log(
      [
        "Usage: pnpm --silent preflight <candidate.json>",
        "",
        "Reports unresolved and invalid fields for a descriptor draft or candidate.",
        "Exit code 0 only when the file passes the canonical schema in full.",
        "Drafts never belong in registry/behaviors/. After review, copy a complete descriptor to registry/behaviors/<id>.json and run:",
        "",
        "  pnpm validate",
      ].join("\n"),
    );
    return 0;
  }

  if (argv.length === 0) {
    console.error("Missing <candidate.json> argument.");
    return 1;
  }

  const result = preflightFile(argv[0]!);
  console.log(formatPreflight(result));
  return result.complete ? 0 : 1;
}

if (process.argv[1]?.endsWith("preflight.ts")) {
  process.exitCode = main();
}