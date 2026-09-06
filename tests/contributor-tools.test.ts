import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("contributor-facing catalog documentation", () => {
  it("points to the live generated catalog instead of carrying an empty snapshot", () => {
    const readme = fs.readFileSync(path.resolve("README.md"), "utf8");
    const policyCount = fs.readdirSync(path.resolve("registry/policies")).filter((file) => file.endsWith(".json")).length;
    expect(policyCount).toBe(18);
    expect(readme).toContain("https://uduckmoves.com");
    expect(readme).toContain("https://uduckmoves.com/registry.json");
    expect(readme).toContain("The live catalog is generated from the authored policies");
    expect(readme).not.toMatch(/(?:empty|no) (?:policy|behavior|entry|catalog|registry)/i);
    expect(readme).not.toContain("BEGIN GENERATED CATALOG TABLE");
    expect(readme).not.toContain("| --- | --- | --- | --- | --- | --- | --- |");
  });
});
