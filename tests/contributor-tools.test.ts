import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { catalogEntryFromPolicy } from "../registry/schema/catalog";
import { PolicySchema, type ResolvedPolicy } from "../registry/schema/policy";
import { renderReadmeCatalog, updateReadmeCatalog } from "../scripts/generate-registry-index";

const README_TABLE_START = "<!-- BEGIN GENERATED CATALOG TABLE -->";
const README_TABLE_END = "<!-- END GENERATED CATALOG TABLE -->";

function entry() {
  const policy = PolicySchema.parse(JSON.parse(fs.readFileSync("registry/policies/alpha-walking.json", "utf8")));
  const resolved: ResolvedPolicy = {
    ...policy,
    resolved: {
      source: policy.source,
      manifest: null,
      license: null,
      resolution: "review",
      install_route: "review",
      unresolved: ["No machine-readable policy manifest is published with this artifact."],
      onnx: { input: [1, 61], output: [1, 14], smoke: "passed", scope: "Shape inspection only." },
      simulation: { status: "not-covered", reason: "No machine-readable policy manifest is published with this artifact." },
    },
  };
  return catalogEntryFromPolicy(resolved, null);
}

describe("contributor tooling", () => {
  it("replaces only the generated README section", () => {
    const catalogEntry = entry();
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uduck-readme-"));
    const readmePath = path.join(tempDir, "README.md");
    try {
      fs.writeFileSync(readmePath, `Intro\n${README_TABLE_START}\n| old row |\n${README_TABLE_END}\nFooter\n`, "utf8");
      updateReadmeCatalog([catalogEntry], readmePath);
      const updated = fs.readFileSync(readmePath, "utf8");
      expect(updated).toContain("Intro\n");
      expect(updated).toContain("Footer\n");
      expect(updated).toContain("| Behavior | ID | Category | Status | Publisher | Setup | Preview |");
      expect(updated).toContain(`[${catalogEntry.name}](https://uduckmoves.com/behaviors/${catalogEntry.id})`);
      expect(updated).not.toContain("old row");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("renders an empty-resolution policy as review instead of inventing install data", () => {
    const catalogEntry = entry();
    expect(catalogEntry.runtime.status).toBe("review");
    expect(catalogEntry.runtime.install.route).toBe("review");
    expect(catalogEntry.runtime.install.command).toBeNull();
    expect(renderReadmeCatalog([catalogEntry])).toContain(catalogEntry.id);
  });
});
