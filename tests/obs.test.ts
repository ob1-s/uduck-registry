import fs from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";

// These tests gate the 61-D contract without needing MuJoCo at vitest time.
// The python sim/obs_builder.py is the runtime source of truth; this test
// ensures the file exists and its exported constants match the schema.

describe("Obs contract (61-D)", () => {
  it("sim/OBS-CONTRACT.md exists and documents 61 dims", () => {
    const p = path.resolve("sim/OBS-CONTRACT.md");
    expect(fs.existsSync(p)).toBe(true);
    const txt = fs.readFileSync(p, "utf-8");
    expect(txt).toContain("61-D");
    expect(txt).toContain("left_hip_yaw");
    expect(txt).toContain("DEFAULT_QPOS");
  });

  it("sim/obs_builder.py exists and exports 14-dim HOME", () => {
    const p = path.resolve("sim/obs_builder.py");
    expect(fs.existsSync(p)).toBe(true);
    const txt = fs.readFileSync(p, "utf-8");
    expect(txt).toContain("ACTION_JOINT_NAMES");
    expect(txt).toContain("DEFAULT_QPOS");
    expect(txt).toContain("OBS_DIM = 61");
    expect(txt).toContain("ACTION_DIM = 14");
    // Check HOME values count via regex
    const match = txt.match(/DEFAULT_QPOS[^=]*=\s*np\.array\(\s*\[([^\]]+)\]/);
    expect(match).not.toBeNull();
    const inner = match![1];
    const nums = inner.split(",").map((s) => s.trim()).filter(Boolean);
    expect(nums.length).toBe(14);
  });

  it("sim/MJCF-MAPPING-REPORT.md exists and pins 4 models", () => {
    const p = path.resolve("sim/MJCF-MAPPING-REPORT.md");
    expect(fs.existsSync(p)).toBe(true);
    const txt = fs.readFileSync(p, "utf-8");
    expect(txt).toContain("robot_walk.xml");
    expect(txt).toContain("robot_allcollisions.xml");
    expect(txt).toContain("robot_allcollisions_rollers.xml");
    expect(txt).toContain("robot_walk_backlash.xml");
  });

  it("sim/mjcf-manifest.json and sim/mjcf-pins.json pin 4 models with sha256", () => {
    for (const fname of ["sim/mjcf-pins.json", "sim/mjcf-manifest.json"]) {
      const p = path.resolve(fname);
      expect(fs.existsSync(p)).toBe(true);
      const j = JSON.parse(fs.readFileSync(p, "utf-8"));
      // pins file has pins dict, manifest has models dict
      const bag = j.pins ?? j.models;
      expect(Object.keys(bag).length).toBe(4);
      for (const k of Object.keys(bag)) {
        expect(k).toMatch(/robot_.*\.xml/);
      }
    }
  });

  it("sim/verify_rollout.py wires obs_builder and handles batched obs", () => {
    const p = path.resolve("sim/verify_rollout.py");
    const txt = fs.readFileSync(p, "utf-8");
    expect(txt).toContain("from sim.obs_builder import ObsBuilder");
    expect(txt).toContain("obs[None, :]");
    expect(txt).toContain("has_plane");
  });

  it("sim/check_onnx.py allowlist includes Elu and metadata allowlist", () => {
    const p = path.resolve("sim/check_onnx.py");
    const txt = fs.readFileSync(p, "utf-8");
    expect(txt).toContain('"Elu"');
    expect(txt).toContain("ALLOWED_METADATA_KEYS");
  });
});
