import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_URL_PATTERN,
  GITHUB_USERNAME_PATTERN,
  ID_PATTERN,
  ONNX_FILENAME_PATTERN,
  HTTPS_URL_PATTERN,
  isAllowedArtifactUrl,
  isAllowedMediaUrl,
  isHttpsUrl,
} from "../registry/schema/allowlist";
import { BehaviorSchema } from "../registry/schema/behavior";

const jsonSchema = JSON.parse(
  fs.readFileSync(path.resolve("registry/schema/behavior.schema.json"), "utf8"),
);

function fixture() {
  return JSON.parse(
    fs.readFileSync(path.resolve("registry/behaviors/alpha-walking.json"), "utf8"),
  ) as Record<string, any>;
}

describe("behavior schema", () => {
  it("accepts every checked-in descriptor", () => {
    const files = fs
      .readdirSync(path.resolve("registry/behaviors"))
      .filter((file) => file.endsWith(".json"))
      .sort();

    for (const file of files) {
      const raw = JSON.parse(
        fs.readFileSync(path.resolve("registry/behaviors", file), "utf8"),
      );
      const result = BehaviorSchema.safeParse(raw);
      expect(result.success, file).toBe(true);
    }
  });

  it("keeps the manual JSON Schema artifact aligned with shared primitives", () => {
    expect(jsonSchema.properties.id.$ref).toBe("#/$defs/id");
    expect(jsonSchema.$defs.id.pattern).toBe(ID_PATTERN.source);
    expect(jsonSchema.$defs.githubUsername.pattern).toBe(GITHUB_USERNAME_PATTERN.source);
    expect(jsonSchema.$defs.onnxFilename.pattern).toBe(ONNX_FILENAME_PATTERN.source);
    expect(jsonSchema.$defs.httpsUrl.pattern).toBe(HTTPS_URL_PATTERN.source.replaceAll("\\/", "/"));
    expect(jsonSchema.$defs.artifactUrl.pattern).toBe(ARTIFACT_URL_PATTERN.source.replaceAll("\\/", "/"));

    const contract = jsonSchema.properties.contract;
    expect(contract.required).toEqual([
      "observation_dim",
      "observation_breakdown",
      "action_dim",
      "action_breakdown",
      "control_frequency_hz",
      "decimation",
      "actuator_model",
      "action_scale",
    ]);
    expect(contract.properties.observation_dim.const).toBe(61);
    expect(contract.properties.action_dim.const).toBe(14);
    expect(contract.properties.control_frequency_hz.const).toBe(50);
    expect(jsonSchema.properties.media.properties.loop_url).toBeDefined();

    for (const schema of [
      jsonSchema,
      jsonSchema.properties.authors.items,
      jsonSchema.properties.verification,
      contract,
      contract.properties.observation_breakdown,
      contract.properties.action_breakdown,
      jsonSchema.properties.compatibility,
      jsonSchema.properties.artifacts,
      jsonSchema.properties.artifacts.properties.onnx,
      jsonSchema.properties.media,
      jsonSchema.properties.sources,
      jsonSchema.properties.deployment,
    ]) {
      expect(schema.additionalProperties).toBe(false);
    }
  });

  it("requires the exact Microduck contract and supported status", () => {
    for (const [pathParts, value] of [
      [["contract", "observation_dim"], 60],
      [["contract", "action_dim"], 15],
      [["contract", "control_frequency_hz"], 49],
      [["contract", "observation_breakdown", "twist"], 4],
    ] as const) {
      const bad = fixture();
      let target = bad;
      for (const key of pathParts.slice(0, -1)) target = target[key];
      target[pathParts.at(-1)!] = value;
      expect(BehaviorSchema.safeParse(bad).success).toBe(false);
    }

    const unsupportedStatus = fixture();
    unsupportedStatus.verification.status = "unknown";
    expect(BehaviorSchema.safeParse(unsupportedStatus).success).toBe(false);

    const missingExplicitContract = fixture();
    delete missingExplicitContract.contract.observation_dim;
    expect(BehaviorSchema.safeParse(missingExplicitContract).success).toBe(false);
  });

  it("uses the same ID, URL, filename, and metadata boundaries", () => {
    expect(isHttpsUrl("https://example.com/policy")).toBe(true);
    expect(isHttpsUrl("http://example.com/policy")).toBe(false);
    expect(isHttpsUrl("https://user:pass@example.com/policy")).toBe(false);
    expect(isAllowedArtifactUrl("https://huggingface.co/model/policy.onnx")).toBe(true);
    expect(isAllowedArtifactUrl("https://huggingface.co:444/model/policy.onnx")).toBe(false);
    expect(isAllowedArtifactUrl("https://evil.example/model/policy.onnx")).toBe(false);
    expect(isAllowedMediaUrl("/media/loops/policy.mp4")).toBe(true);
    expect(isAllowedMediaUrl("//evil.example/policy.mp4")).toBe(false);

    for (const [field, value] of [
      ["id", "Alpha-Walking"],
      ["artifacts.onnx.url", "https://evil.example/policy.onnx"],
      ["artifacts.onnx.filename", "../policy.onnx"],
      ["authors[0].github", "not_a_github_name"],
      ["authors[0].url", "http://example.com/author"],
      ["media.thumbnail_url", "//evil.example/image.jpg"],
    ] as const) {
      const bad = fixture();
      if (field === "id") bad.id = value;
      if (field === "artifacts.onnx.url") bad.artifacts.onnx.url = value;
      if (field === "artifacts.onnx.filename") bad.artifacts.onnx.filename = value;
      if (field === "authors[0].github") bad.authors[0].github = value;
      if (field === "authors[0].url") bad.authors[0].url = value;
      if (field === "media.thumbnail_url") bad.media.thumbnail_url = value;
      expect(BehaviorSchema.safeParse(bad).success, field).toBe(false);
    }

    const badNestedKey = fixture();
    badNestedKey.verification.unexpected = true;
    expect(BehaviorSchema.safeParse(badNestedKey).success).toBe(false);

    const badCompatibilityKey = fixture();
    badCompatibilityKey.compatibility.unexpected = "value";
    expect(BehaviorSchema.safeParse(badCompatibilityKey).success).toBe(false);
  });

  it("accepts the optional simulation block and rejects bad values", () => {
    const withSim = fixture();
    withSim.simulation = {
      profile: "velocity",
      duration_s: 8,
      segments: [
        { duration_s: 2, vx: 0.2, vy: 0, wz: 0 },
        { duration_s: 1.5, vx: 0.1, vy: 0, wz: 0.5 },
      ],
    };
    expect(BehaviorSchema.safeParse(withSim).success).toBe(true);

    const minimal = fixture();
    minimal.simulation = { profile: "standing" };
    expect(BehaviorSchema.safeParse(minimal).success).toBe(true);

    for (const sim of [
      { profile: "teleport" },
      { duration_s: 0.5 },
      { duration_s: 60 },
      { end_phase: 1.5 },
      { segments: [{ duration_s: 0, vx: 0, vy: 0, wz: 0 }] },
      { segments: [{ duration_s: 1, vx: 0, vy: 0, wz: 0, boost: 1 }] },
    ]) {
      const bad = fixture();
      bad.simulation = sim;
      expect(BehaviorSchema.safeParse(bad).success, JSON.stringify(sim)).toBe(false);
    }

    const badKey = fixture();
    badKey.simulation = { profile: "standing", warp: true };
    expect(BehaviorSchema.safeParse(badKey).success).toBe(false);
  });

});
