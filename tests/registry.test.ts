import { describe, it, expect } from "vitest";
import { validateAllBehaviors } from "../scripts/validate-registry";

describe("uDuck Registry Integrity", () => {
  const { valid, behaviors, errors } = validateAllBehaviors();

  it("should validate all behavior files without schema errors", () => {
    if (errors.length > 0) {
      console.error(errors);
    }
    expect(valid).toBe(true);
    expect(errors).toHaveLength(0);
    expect(behaviors.length).toBeGreaterThan(0);
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
    const validStatuses = ["verified_hardware", "claimed_hardware", "community_experimental"];
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

  it("keeps upstream origin separate from independent hardware verification", () => {
    const hwBehaviors = behaviors.filter((b) => b.verification.status === "claimed_hardware");
    expect(hwBehaviors.length).toBeGreaterThanOrEqual(5);
    const ids = hwBehaviors.map((b) => b.id);
    expect(ids).toContain("alpha-walking");
    expect(ids).toContain("fall-recovery");
    expect(ids).toContain("ground-pick");
    expect(ids).toContain("roller-drive");
  });
});
