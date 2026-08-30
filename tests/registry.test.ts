import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import { validateAllBehaviors } from "../scripts/validate-registry";
import { BehaviorSchema, isDiscoverableBehavior } from "../registry/schema/behavior";
import { isAllowedArtifactUrl } from "../registry/schema/allowlist";


describe("uDuck Registry Integrity", () => {
  const { valid, behaviors, errors } = validateAllBehaviors();

  it("should validate all behavior files without schema errors", () => {
    if (errors.length > 0) {
      console.error(errors);
    }
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
    expect(behaviors.length).toBeGreaterThanOrEqual(10);
  });

  it("should adhere to the strict 61-D observation and 14-action contract", () => {
    for (const b of behaviors) {
      expect(b.contract.observation_dim).toBe(61);
      expect(b.contract.action_dim).toBe(14);
      expect(b.contract.control_frequency_hz).toBe(50);
      
      const { proprioception, twist, head_pose, body_pose } = b.contract.observation_breakdown;
      expect(proprioception + twist + head_pose + body_pose).toBe(61);

      const { left_leg, neck_head, right_leg } = b.contract.action_breakdown;
      expect(left_leg + neck_head + right_leg).toBe(14);
    }
  });

  it("should have valid verification status and hardware targets", () => {
    const validStatuses = ["verified_hardware", "claimed_hardware", "verified_simulation", "community_experimental"];
    for (const b of behaviors) {
      expect(validStatuses).toContain(b.verification.status);
      expect(b.verification.hardware_target.length).toBeGreaterThan(3);
    }
  });

  it("should have functional deployment snippets for robotd.toml", () => {
    for (const b of behaviors) {
      expect(b.deployment.robotd_toml).toContain("[policy]");
    }
  });

  it("should include real hardware verified behaviors from Pollen", () => {
    const hwBehaviors = behaviors.filter((b) => b.verification.status === "verified_hardware");
    expect(hwBehaviors.length).toBeGreaterThanOrEqual(5);
    const ids = hwBehaviors.map((b) => b.id);
    expect(ids).toContain("alpha-walking");
    expect(ids).toContain("fall-recovery");
    expect(ids).toContain("ground-pick");
    expect(ids).toContain("roller-drive");
  });
});

describe("Discovery gate", () => {
  it("keeps source-only records in validation but out of public catalog reads", () => {
    const { behaviors } = validateAllBehaviors();
    const sourceOnlyIds = behaviors
      .filter((behavior) => !isDiscoverableBehavior(behavior))
      .map((behavior) => behavior.id)
      .sort();

    expect(sourceOnlyIds).toEqual([
      "backlash-walking",
      "roller-slope",
      "roller-swizzle",
      "rough-terrain-walk",
      "spin-in-place",
      "standing-body-control",
    ]);
    const publicIndex = JSON.parse(fs.readFileSync("public/registry.json", "utf8")) as {
      count: number;
      behaviors: Array<{ id: string; discovery: { status: string } }>;
    };
    expect(publicIndex.count).toBe(publicIndex.behaviors.length);
    for (const id of sourceOnlyIds) {
      expect(publicIndex.behaviors.map((behavior) => behavior.id)).not.toContain(id);
    }
    expect(publicIndex.behaviors).toHaveLength(14);
    expect(publicIndex.behaviors.every((behavior) => behavior.discovery.status === "listed")).toBe(true);
  });
});

describe("Artifact integrity (v0.1 hardened slice)", () => {
  const { behaviors } = validateAllBehaviors();

  it("should reject unknown keys (strict schema)", () => {
    const bad = { ...(behaviors[0] as any), not_a_field: true };
    const result = BehaviorSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("should pin verified artifacts and check the local cache when present", () => {
    const verified = behaviors.filter(
      (b) => b.verification.status === "verified_hardware" || b.verification.status === "verified_simulation",
    );
    expect(verified.length).toBeGreaterThan(0);
    for (const b of verified) {
      expect(b.artifacts.onnx.sha256, `${b.id} missing sha256`).toBeDefined();
      expect(b.artifacts.onnx.size_bytes, `${b.id} missing size_bytes`).toBeDefined();
      const vendorPath = path.resolve("vendor/policies", `${b.id}.onnx`);
      if (fs.existsSync(vendorPath)) {
        expect(fs.statSync(vendorPath).size, `${b.id} cache size`).toBe(b.artifacts.onnx.size_bytes);
      }
    }
  });

  it("should reject artifact URLs outside the host allowlist", () => {
    for (const b of behaviors) {
      expect(isAllowedArtifactUrl(b.artifacts.onnx.url), `${b.id} bad URL`).toBe(true);
    }
    expect(isAllowedArtifactUrl("http://huggingface.co/x.onnx")).toBe(false);
    expect(isAllowedArtifactUrl("https://evil.example.com/x.onnx")).toBe(false);
  });

});
