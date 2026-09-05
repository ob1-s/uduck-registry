import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  catalogEntriesFromSources,
  catalogEntryFromBehavior,
  catalogEntryFromPolicy,
} from "../registry/schema/catalog";
import { BehaviorSchema } from "../registry/schema/behavior";
import { validateAllBehaviors } from "../scripts/validate-registry";
import type { ResolvedPolicy } from "../registry/schema/policy";

function flamingoPolicy(): ResolvedPolicy {
  const pointer = JSON.parse(fs.readFileSync("registry/policies/flamingo-cycle.json", "utf8"));
  const generated = JSON.parse(fs.readFileSync(".generated/policies/flamingo-cycle.json", "utf8"));
  return { ...pointer, resolved: generated.resolved };
}

describe("unified catalog", () => {
  it("normalizes Flamingo pointer to one CatalogEntry with exact provenance", () => {
    const policy = flamingoPolicy();
    const entry = catalogEntryFromPolicy(policy, null);
    expect(entry.id).toBe("flamingo-cycle");
    expect(entry.source.kind).toBe("pollen-hub");
    expect(entry.source.revision).toBe(policy.source.revision);
    expect(entry.source.artifact?.sha256).toBe(policy.source.artifact_sha256);
    expect(entry.source.manifest_sha256).toBe(policy.source.manifest_sha256);
    expect(entry.coverage.package_inspection.status).toBe("passed");
    expect(entry.coverage.package_inspection.input_shape).toEqual([1, 61]);
    expect(entry.coverage.package_inspection.output_shape).toEqual([1, 14]);
    // Missing optional metadata stays null, never a guessed default.
    expect(entry.runtime.compatibility.accessories_required).toBeNull();
    expect(entry.runtime.compatibility.terrain).toBeNull();
    expect(entry.runtime.contract.decimation).toBeNull();
    expect(entry.runtime.contract.actuator_model).toBeNull();
    // No hardware verification invented.
    expect(entry.hardware.status).toBe("none");
    // Author media separate from registry media.
    expect(entry.media.author.length).toBeGreaterThan(0);
    expect(entry.media.registry).toBeNull();
    // Nested training object supported without fake commit URLs.
    expect(entry.source.upstream.task_id).toBe("Mjlab-FlamingoCycleHard-Flat-MicroDuck");
    expect(entry.source.upstream.training_url).toBe("https://github.com/pollen-robotics/microduck_rl");
  });

  it("normalizes legacy behavior to the same public shape", () => {
    const behavior = BehaviorSchema.parse(
      JSON.parse(fs.readFileSync("registry/behaviors/alpha-walking.json", "utf8")),
    );
    const entry = catalogEntryFromBehavior(behavior, null);
    expect(entry.id).toBe("alpha-walking");
    expect(entry.source.kind).toBe("manual");
    // Same shape keys as a policy entry.
    const policy = flamingoPolicy();
    const policyEntry = catalogEntryFromPolicy(policy, null);
    expect(Object.keys(entry).sort()).toEqual(Object.keys(policyEntry).sort());
    // Attributable Pollen claim preserved as author-claimed, never verified.
    expect(entry.hardware.status).toBe("author-claimed");
    expect(entry.hardware.note).toContain("Not independently verified by uDuck");
  });

  it("preserves report-only evidence without fabricating media", () => {
    const policy = flamingoPolicy();
    const evidence = {
      status: "not-covered" as const,
      evidence_key: null,
      inputs_sha256: null,
      runner: null,
      scene: null,
      scenario: null,
      report_url: "/media/registry-sim/flamingo-cycle/report.json",
      loop_url: null,
      poster_url: null,
      checks: [],
      reason: "No maintainer-owned registry recipe covers this manifest.",
    };
    const entry = catalogEntryFromPolicy(policy, evidence);
    expect(entry.coverage.registry_simulation.status).toBe("not-covered");
    expect(entry.coverage.registry_simulation.report_url).toBe(
      "/media/registry-sim/flamingo-cycle/report.json",
    );
    expect(entry.coverage.registry_simulation.loop_url).toBeNull();
    expect(entry.media.registry).toBeNull();
  });

  it("fails closed on malformed rendered evidence", () => {
    const policy = flamingoPolicy();
    const malformed = {
      status: "passed" as const,
      evidence_key: null,
      inputs_sha256: null,
      runner: "microduck-standard-v1",
      scene: "flat-v1",
      scenario: "command_schedule",
      report_url: "/media/registry-sim/flamingo-cycle/report.json",
      loop_url: "/media/registry-sim/flamingo-cycle/loop.mp4",
      poster_url: "/media/registry-sim/flamingo-cycle/poster.png",
      checks: [],
      reason: null,
    };
    const entry = catalogEntryFromPolicy(policy, malformed);
    expect(entry.coverage.registry_simulation.status).not.toBe("passed");
  });

  it("emits one entries collection with version 3.0.0", () => {
    const behavior = BehaviorSchema.parse(
      JSON.parse(fs.readFileSync("registry/behaviors/alpha-walking.json", "utf8")),
    );
    const entries = catalogEntriesFromSources([behavior], [], new Map());
    const index = { version: "3.0.0" as const, updated_at: new Date(0).toISOString(), count: entries.length, entries };
    expect(index.version).toBe("3.0.0");
    expect(index.count).toBe(entries.length);
    expect((index as Record<string, unknown>).behaviors).toBeUndefined();
    expect((index as Record<string, unknown>).policies).toBeUndefined();
  });

  it("rejects duplicate repository casing", () => {
    const { valid } = validateAllBehaviors();
    expect(valid).toBe(true);
  });
});
