import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

  it("rejects a revision of one logical source as a second catalog entry", () => {
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), "uduck-registry-"));
    try {
      const original = JSON.parse(fs.readFileSync("registry/policies/alpha-walking.json", "utf8"));
      fs.writeFileSync(path.join(directory, "alpha-walking.json"), JSON.stringify(original));
      fs.writeFileSync(path.join(directory, "alpha-walking-revision.json"), JSON.stringify({
        ...original,
        id: "alpha-walking-revision",
        source: { ...original.source, revision: "b".repeat(40) },
      }));

      const result = validatePolicies(directory);
      expect(result.valid).toBe(false);
      expect(result.errors.some((error) => error.includes("Duplicate logical source detected"))).toBe(true);
    } finally {
      fs.rmSync(directory, { recursive: true, force: true });
    }
  });
});
