import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_URL_PATTERN,
  GITHUB_USERNAME_PATTERN,
  ID_PATTERN,
  MJCF_FILENAME_PATTERN,
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
    fs.readFileSync(path.resolve("registry/behaviors/backlash-walking.json"), "utf8"),
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
    expect(jsonSchema.$defs.mjcfFilename.pattern).toBe(MJCF_FILENAME_PATTERN.source);
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
    expect(jsonSchema.properties.discovery.required).toEqual(["status"]);
    expect(jsonSchema.properties.discovery.properties.status.enum).toEqual(["listed", "source_only"]);
    expect(jsonSchema.properties.sim_verification.required).toContain("verified_at");
    expect(jsonSchema.properties.hardware_attestation.required).toEqual([
      "pr_url",
      "video_url",
      "logs_path",
      "attested_at",
    ]);

    for (const schema of [
      jsonSchema,
      jsonSchema.properties.authors.items,
      jsonSchema.properties.verification,
      jsonSchema.properties.discovery,
      jsonSchema.properties.sim_verification,
      jsonSchema.properties.hardware_attestation,
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

  it("requires the exact Microduck contract and explicit simulation evidence", () => {
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

    const missingEvidence = fixture();
    missingEvidence.verification.status = "verified_simulation";
    expect(BehaviorSchema.safeParse(missingEvidence).success).toBe(false);

    const withEvidence = fixture();
    withEvidence.verification.status = "verified_simulation";
    withEvidence.sim_verification = {
      mujoco_version: "3.12.0",
      mjcf_sha256: "a".repeat(64),
      seed: 0,
      episode_length_s: 10,
      grade: "pass",
      travel_score: 1,
      stability_score: 1,
      fell: false,
      verified_at: "2026-08-29T12:00:00Z",
    };
    expect(BehaviorSchema.safeParse(withEvidence).success).toBe(true);

    const failedEvidence = { ...withEvidence, sim_verification: { ...withEvidence.sim_verification, grade: "fail" } };
    expect(BehaviorSchema.safeParse(failedEvidence).success).toBe(false);

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

    const badDiscovery = fixture();
    badDiscovery.discovery.status = "unlisted";
    expect(BehaviorSchema.safeParse(badDiscovery).success).toBe(false);

    const badDiscoveryKey = fixture();
    badDiscoveryKey.discovery.unexpected = true;
    expect(BehaviorSchema.safeParse(badDiscoveryKey).success).toBe(false);
  });

  it("validates structured hardware attestations when supplied", () => {
    const valid = fixture();
    valid.hardware_attestation = {
      pr_url: "https://github.com/ob1-s/uduck-registry/pull/1",
      video_url: "https://github.com/user-attachments/assets/example",
      logs_path: "evidence/alpha-walking.log",
      attested_at: "2026-08-29T12:00:00Z",
    };
    expect(BehaviorSchema.safeParse(valid).success).toBe(true);

    const invalid = fixture();
    invalid.hardware_attestation = {
      pr_url: "http://github.com/ob1-s/uduck-registry/pull/1",
      video_url: "https://github.com/user-attachments/assets/example",
      logs_path: "evidence/alpha-walking.log",
      attested_at: "not-a-timestamp",
    };
    expect(BehaviorSchema.safeParse(invalid).success).toBe(false);
  });
});
