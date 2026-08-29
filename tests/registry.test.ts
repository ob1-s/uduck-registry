import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { describe, it, expect } from "vitest";
import { validateAllBehaviors } from "../scripts/validate-registry";
import { BehaviorSchema, type Behavior } from "../registry/schema/behavior";
import { isAllowedArtifactUrl } from "../registry/schema/allowlist";
import { pullArtifact } from "../scripts/lib/pull-artifact";


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

describe("Artifact integrity (v0.1 hardened slice)", () => {
  const { valid, behaviors } = validateAllBehaviors();

  it("should reject unknown keys (strict schema)", () => {
    const bad = { ...(behaviors[0] as any), not_a_field: true };
    const result = BehaviorSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("should have verified tiers backed by vendored bytes with matching sha256", () => {
    const verified = behaviors.filter(
      (b) => b.verification.status === "verified_hardware" || b.verification.status === "verified_simulation",
    );
    expect(verified.length).toBeGreaterThan(0);
    for (const b of verified) {
      expect(b.artifacts.onnx.sha256, `${b.id} missing sha256`).toBeDefined();
      expect(b.artifacts.onnx.size_bytes, `${b.id} missing size_bytes`).toBeDefined();
      const vendorPath = path.resolve("vendor/policies", `${b.id}.onnx`);
      expect(fs.existsSync(vendorPath), `${b.id} not vendored`).toBe(true);
      const buf = fs.readFileSync(vendorPath);
      expect(buf.length).toBe(b.artifacts.onnx.size_bytes);
      expect(crypto.createHash("sha256").update(buf).digest("hex")).toBe(b.artifacts.onnx.sha256);
    }
  });

  it("should reject artifact URLs outside the host allowlist", () => {
    for (const b of behaviors) {
      expect(isAllowedArtifactUrl(b.artifacts.onnx.url), `${b.id} bad URL`).toBe(true);
    }
    expect(isAllowedArtifactUrl("http://huggingface.co/x.onnx")).toBe(false);
    expect(isAllowedArtifactUrl("https://evil.example.com/x.onnx")).toBe(false);
  });

  it("pullArtifact should verify hashes and refuse tampered bytes", async () => {
    const b = behaviors.find((x) => x.verification.status === "verified_hardware")!;
    const res = await pullArtifact(b, "/tmp/uduck-test-pull");
    expect(res.hashMatch).toBe(true);
    expect(res.source).toBe("vendored");

    // Tampered expected hash must throw, writing nothing.
    const tampered: Behavior = {
      ...b,
      artifacts: { ...b.artifacts, onnx: { ...b.artifacts.onnx, sha256: "0".repeat(64) } },
    };
    await expect(pullArtifact(tampered, "/tmp/uduck-test-pull")).rejects.toThrow(/hash/i);
  });

  it("pullArtifact should refuse unsafe ids and filenames", async () => {
    const evil: Behavior = {
      ...(behaviors[0] as Behavior),
      id: "../evil" as Behavior["id"],
    };
    await expect(pullArtifact(evil, "/tmp/uduck-test-pull")).rejects.toThrow(/unsafe/i);
  });
});

