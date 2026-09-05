import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import alphaWalkingJson from "../registry/behaviors/alpha-walking.json";
import { BehaviorSchema } from "../registry/schema/behavior";
import { renderReadmeCatalog, updateReadmeCatalog } from "../scripts/generate-registry-index";
import { createBehaviorScaffold, parseScaffoldArgs } from "../scripts/new-behavior";

const README_TABLE_START = "<!-- BEGIN GENERATED BEHAVIOR TABLE -->";
const README_TABLE_END = "<!-- END GENERATED BEHAVIOR TABLE -->";

describe("contributor tooling", () => {
  it("creates an intentionally incomplete draft without invented runtime facts", () => {
    const options = parseScaffoldArgs([
      "id=moon-walk",
      "category=locomotion",
      "author=Ada Lovelace",
      "description=A small test behavior.",
      "license=Apache-2.0",
    ]);
    const scaffold = createBehaviorScaffold(options);

    expect(options.name).toBe("Moon Walk");
    expect(scaffold).toMatchObject({
      id: "moon-walk",
      name: "Moon Walk",
      category: "locomotion",
      authors: [{ name: "Ada Lovelace" }],
      license: "Apache-2.0",
      contract: null,
      compatibility: null,
      artifacts: null,
      deployment: null,
    });
    expect(BehaviorSchema.safeParse(scaffold).success).toBe(false);
  });

  it("rejects malformed scaffold arguments", () => {
    expect(() => parseScaffoldArgs([])).toThrow(/Missing required field 'id'/);
    expect(() => parseScaffoldArgs(["id=bad_id"])).toThrow(/lowercase kebab-case/);
    expect(() => parseScaffoldArgs(["id=good-id", "category=unknown"])).toThrow(/Invalid category/);
  });

  it("replaces only the generated README section", () => {
    const behavior = BehaviorSchema.parse(alphaWalkingJson);
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uduck-readme-"));
    const readmePath = path.join(tempDir, "README.md");

    try {
      fs.writeFileSync(
        readmePath,
        `Intro\n${README_TABLE_START}\n| old row |\n${README_TABLE_END}\nFooter\n`,
        "utf-8",
      );

      updateReadmeCatalog([behavior], readmePath);

      const updated = fs.readFileSync(readmePath, "utf-8");
      expect(updated).toContain("Intro\n");
      expect(updated).toContain("Footer\n");
      expect(updated).toContain("| Behavior | ID | Category | Status | Publisher | Setup | Preview |");
      expect(updated).toContain(`[${behavior.name}](https://uduckmoves.com/behaviors/${behavior.id})`);
      expect(updated).not.toContain("old row");
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
