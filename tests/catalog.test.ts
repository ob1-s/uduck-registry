import fs from "node:fs";
import { describe, expect, it } from "vitest";
import { catalogEntries, catalogEntryFromPolicy } from "../registry/schema/catalog";
import { PolicySchema, type ResolvedPolicy } from "../registry/schema/policy";
import { primaryMedia } from "../src/lib/catalog";

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
      install_unresolved: [],
      policy_set: false,
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
    expect(entry.hardware.target).toBeNull();
    expect(entry.hardware.source_url).toBeNull();
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

  it("keeps publisher hardware and setup facts separate from registry evidence", () => {
    const policy = flamingoPolicy();
    policy.curation.requirements = { robot_model: "microduck-standard", accessories: ["70mm_practice_ball"], terrain: ["flat"] };
    policy.curation.publisher_hardware = {
      status: "claimed",
      target: "Microduck v1",
      source_url: "https://github.com/pollen-robotics/microduck",
      note: "Publisher claim only.",
    };
    const entry = catalogEntryFromPolicy(policy, {
      status: "passed",
      evidence_key: "a".repeat(64),
      inputs_sha256: "b".repeat(64),
      runner: "microduck-standard-v1",
      scene: "flat-v1",
      scenario: "command_schedule",
      checks: [{ check: "no_fall", passed: true, detail: "measured" }],
    });
    expect(entry.hardware.status).toBe("author-claimed");
    expect(entry.hardware.target).toBe("Microduck v1");
    expect(entry.hardware.source_url).toBe("https://github.com/pollen-robotics/microduck");
    expect(entry.runtime.compatibility.accessories_required).toEqual(["70mm_practice_ball"]);
    expect(entry.coverage.registry_simulation.status).toBe("passed");
  });

  it("keeps source media primary while retaining complete registry evidence media", () => {
    const entry = catalogEntryFromPolicy(flamingoPolicy(), {
      status: "failed",
      evidence_key: "a".repeat(64),
      inputs_sha256: "b".repeat(64),
      runner: "microduck-standard-v1",
      scene: "flat-v1",
      scenario: "command_schedule",
      report_url: "/media/registry-sim/flamingo-cycle/report.json",
      loop_url: "/media/registry-sim/flamingo-cycle/loop.mp4",
      poster_url: "/media/registry-sim/flamingo-cycle/poster.png",
      checks: [{ check: "no_fall", passed: false, detail: "measured" }],
      reason: "The requested diagnostic check failed.",
    });
    expect(entry.media.primary).toBe("author");
    expect(entry.media.registry).toEqual({
      loop_url: "/media/registry-sim/flamingo-cycle/loop.mp4",
      poster_url: "/media/registry-sim/flamingo-cycle/poster.png",
      report_url: "/media/registry-sim/flamingo-cycle/report.json",
    });
    expect(primaryMedia(entry).hero_type).toBe("video");
    expect(primaryMedia(entry).video_url).toBe(entry.media.author.find((item) => item.type === "video")?.url);
    expect(entry.coverage.registry_simulation.status).toBe("failed");
  });

  it("uses registry evidence as the hero only when source media is absent", () => {
    const policy = flamingoPolicy();
    policy.media = [];
    const entry = catalogEntryFromPolicy(policy, {
      status: "failed",
      evidence_key: "a".repeat(64),
      inputs_sha256: "b".repeat(64),
      runner: "microduck-standard-v1",
      scene: "flat-v1",
      scenario: "oneshot_zero",
      report_url: "/media/registry-sim/flamingo-cycle/report.json",
      loop_url: "/media/registry-sim/flamingo-cycle/loop.mp4",
      poster_url: "/media/registry-sim/flamingo-cycle/poster.png",
      checks: [{ check: "recover_upright", passed: true, detail: "measured" }],
    });
    expect(entry.media.primary).toBe("registry");
    expect(primaryMedia(entry)).toMatchObject({
      hero_type: "video",
      loop_url: "/media/registry-sim/flamingo-cycle/loop.mp4",
      thumbnail_url: "/media/registry-sim/flamingo-cycle/poster.png",
    });
  });

  it("keeps publisher media primary for a not-covered Courier entry", () => {
    const policy = PolicySchema.parse(JSON.parse(fs.readFileSync("registry/policies/courier.json", "utf8")));
    const entry = catalogEntryFromPolicy({
      ...policy,
      resolved: {
        source: policy.source,
        manifest: null,
        license: policy.curation.license ?? null,
        resolution: "review",
        install_route: "review",
        unresolved: ["No machine-readable package manifest is published with this artifact."],
        install_unresolved: [],
        policy_set: false,
        onnx: { input: [], output: [], smoke: "failed", scope: "Shape inspection only." },
        simulation: { status: "not-covered", reason: "No maintainer-owned execution recipe covers this source." },
      },
    }, null);
    expect(entry.media.primary).toBe("author");
    expect(primaryMedia(entry).video_url).toBe(entry.media.author.find((item) => item.type === "video")?.url);
    expect(entry.coverage.registry_simulation.status).toBe("not-covered");
  });

  it("falls back to the duckmark when neither source nor registry media exists", () => {
    const policy = flamingoPolicy();
    policy.media = [];
    const entry = catalogEntryFromPolicy(policy, null);
    expect(entry.media.primary).toBe("none");
    expect(primaryMedia(entry)).toEqual({ hero_type: "badge" });
  });

  it("only synthesizes exact robotctl targets for single-artifact Hugging Face models", () => {
    const base = flamingoPolicy();
    base.resolved = {
      ...base.resolved,
      policy_set: false,
      resolution: "ready",
      install_route: "skill",
      install_unresolved: [],
      manifest: { ...base.resolved.manifest, kind: "episodic", duration_s: 1, action_scale: 1, command: { encoding: "constant" } },
    };
    const hf = catalogEntryFromPolicy({
      ...base,
      source: { ...base.source, provider: "huggingface-model", artifact_path: "ball_kick_left.onnx" },
    }, null);
    expect(hf.runtime.install.route).toBe("skill");
    expect(hf.runtime.install.command).toContain("@6646428394c6997106d2dc07c1588f20f6fea026:ball_kick_left.onnx");

    for (const provider of ["github", "huggingface-space"] as const) {
      const entry = catalogEntryFromPolicy({
        ...base,
        source: { ...base.source, provider, artifact_path: "ball_kick_left.onnx" },
      }, null);
      expect(entry.runtime.install.route).toBe("review");
      expect(entry.runtime.install.command).toBeNull();
      expect(entry.runtime.install.reason).toContain("No supported robotctl install route");
    }

    const officialSet = catalogEntryFromPolicy({
      ...base,
      source: { ...base.source, provider: "huggingface-model", artifact_path: "ball_kick_left.onnx" },
      resolved: { ...base.resolved, policy_set: true },
    }, null);
    expect(officialSet.runtime.install.route).toBe("review");
    expect(officialSet.runtime.install.command).toBeNull();
    expect(officialSet.runtime.install.reason).toContain("updated as a set");
  });

  it("emits one entries collection", () => {
    const entries = catalogEntries([flamingoPolicy()]);
    const index = { version: "4.0.0", updated_at: new Date(0).toISOString(), count: entries.length, entries };
    expect(index.count).toBe(1);
    expect((index as Record<string, unknown>).policies).toBeUndefined();
  });
});
