import { describe, expect, it } from "vitest";
import { validatePolicies } from "../scripts/validate-registry";

describe("uDuck policy registry integrity", () => {
  const result = validatePolicies();

  it("validates every authored policy", () => {
    expect(result.valid, result.errors.join("\n")).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.policies).toHaveLength(18);
  });

  it("requires immutable artifacts and does not retain the dropped recovery entry", () => {
    for (const policy of result.policies) {
      expect(policy.source.revision).toMatch(/^[a-f0-9]{40}$/);
      expect(policy.source.artifact_sha256).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(result.policies.some((policy) => policy.id === "fall-recovery")).toBe(false);
  });
});
