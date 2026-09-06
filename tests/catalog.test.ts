import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogEntries, catalogEntryFromPolicy } from "../registry/schema/catalog";
import { PolicySchema, type ResolvedPolicy } from "../registry/schema/policy";

function flamingoPolicy(): ResolvedPolicy {
  const policy = PolicySchema.parse(JSON.parse(fs.readFileSync("registry/policies/flamingo-cycle.json", "utf8")));
  return {
    ...policy,
    resolved: {
      source: policy.source,
      manifest: {
        schema_version: 2,
        model_api: 1,
        name: "flamingo-cycle",
        kind: "perpetual",
        obs_len: 61,
        action_len: 14,
        action_scale: 1,
        command: { encoding: "constant", idle: [0, 0, 0] },
        robot: { model: "microduck", hw_rev: 1, servos: "xl330", control_hz: 50 },
        training: { repo: "pollen-robotics/microduck_rl", task_id: "flamingo" },
      },
      license: "apache-2.0",
      resolution: "review",
      install_route: "review",
      unresolved: ["Held pose requires an explicit command and hold/unwind review"],
      onnx: { input: [1, 61], output: [1, 14], smoke: "passed", scope: "Shape inspection only." },
      simulation: {
        status: "covered",
        recipe: {
          runner: "microduck-standard-v1",
          model: "microduck-standard",
          scene: "flat-v1",
          start: { preset: "settled_standing" },
          scenario: "command_schedule",
          duration_s: 5,
          segments: [{ duration_s: 5, command: [1, 1, 0] }],
          checks: ["no_fall"],
        },
        scope: "Pinned diagnostic only.",
      },
    },
  };
}

describe("policy catalog boundary", () => {
  it("normalizes one resolved policy into the public CatalogEntry shape", () => {
    const policy = flamingoPolicy();
    const entry = catalogEntryFromPolicy(policy, null);
    expect(entry.id).toBe("flamingo-cycle");
    expect(entry.source.kind).toBe("huggingface-model");
    expect(entry.source.revision).toBe(policy.source.revision);
    expect(entry.source.artifact.sha256).toBe(policy.source.artifact_sha256);
    expect(entry.source.manifest_sha256).toBe(policy.source.manifest_sha256);
    expect(entry.coverage.package_inspection.status).toBe("passed");
    expect(entry.runtime.compatibility.accessories_required).toBeNull();
    expect(entry.runtime.compatibility.terrain).toBeNull();
    expect(entry.hardware.status).toBe("none");
    expect(entry.media.author.length).toBeGreaterThan(0);
  });

  it("keeps not-covered evidence visible without fabricating media", () => {
    const entry = catalogEntryFromPolicy(flamingoPolicy(), {
      status: "not-covered",
      evidence_key: null,
      inputs_sha256: null,
      runner: null,
      scene: null,
      scenario: null,
      report_url: "/media/registry-sim/flamingo-cycle/report.json",
      loop_url: null,
      poster_url: null,
      checks: [],
      reason: "No maintainer-owned execution recipe covers this source.",
    });
    expect(entry.coverage.registry_simulation.status).toBe("not-covered");
    expect(entry.coverage.registry_simulation.report_url).toBe("/media/registry-sim/flamingo-cycle/report.json");
    expect(entry.media.registry).toBeNull();
  });

  it("exposes resolver-level not-covered status before a report is hydrated", () => {
    const policy = flamingoPolicy();
    policy.resolved.simulation = {
      status: "not-covered",
      reason: "No maintainer-owned execution recipe covers this source.",
    };
    const entry = catalogEntryFromPolicy(policy, null);
    expect(entry.coverage.registry_simulation.status).toBe("not-covered");
    expect(entry.coverage.registry_simulation.reason).toBe("No maintainer-owned execution recipe covers this source.");
    expect(entry.media.registry).toBeNull();
  });

  it("fails closed on malformed passed evidence", () => {
    const entry = catalogEntryFromPolicy(flamingoPolicy(), {
      status: "passed",
      evidence_key: null,
      inputs_sha256: null,
      runner: "microduck-standard-v1",
      scene: "flat-v1",
      scenario: "command_schedule",
      checks: [],
    });
    expect(entry.coverage.registry_simulation.status).not.toBe("passed");
  });

  it("emits one entries collection", () => {
    const entries = catalogEntries([flamingoPolicy()]);
    const index = { version: "4.0.0", updated_at: new Date(0).toISOString(), count: entries.length, entries };
    expect(index.count).toBe(1);
    expect((index as Record<string, unknown>).policies).toBeUndefined();
  });
});
