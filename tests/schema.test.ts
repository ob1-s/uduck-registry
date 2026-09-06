import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  ARTIFACT_URL_PATTERN,
  GITHUB_USERNAME_PATTERN,
  ID_PATTERN,
  HTTPS_URL_PATTERN,
  isAllowedArtifactUrl,
  isAllowedMediaUrl,
  isHttpsUrl,
} from "../registry/schema/allowlist";
import { PolicySchema } from "../registry/schema/policy";

function fixture() {
  return JSON.parse(fs.readFileSync(path.resolve("registry/policies/alpha-walking.json"), "utf8")) as Record<string, any>;
}

describe("authored policy schema", () => {
  it("accepts every checked-in policy", () => {
    const directory = path.resolve("registry/policies");
    const files = fs.readdirSync(directory).filter((file) => file.endsWith(".json")).sort();
    expect(files.length).toBe(18);
    for (const file of files) expect(PolicySchema.safeParse(JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"))).success, file).toBe(true);
  });

  it("uses shared ID, URL, and path boundaries", () => {
    expect(ID_PATTERN.test("alpha-walking")).toBe(true);
    expect(GITHUB_USERNAME_PATTERN.test("pollen-robotics")).toBe(true);
    expect(isHttpsUrl("https://example.com/policy")).toBe(true);
    expect(isHttpsUrl("http://example.com/policy")).toBe(false);
    expect(isHttpsUrl("https://user:pass@example.com/policy")).toBe(false);
    expect(isAllowedArtifactUrl("https://huggingface.co/model/policy.onnx")).toBe(true);
    expect(isAllowedArtifactUrl("https://huggingface.co:444/model/policy.onnx")).toBe(false);
    expect(isAllowedArtifactUrl("https://evil.example/model/policy.onnx")).toBe(false);
    expect(isAllowedMediaUrl("/media/loops/policy.mp4")).toBe(true);
    expect(isAllowedMediaUrl("//evil.example/policy.mp4")).toBe(false);
    expect(HTTPS_URL_PATTERN.test("https://example.com")).toBe(true);
    expect(ARTIFACT_URL_PATTERN.test("https://raw.githubusercontent.com/o/r/a/policy.onnx")).toBe(true);
  });

  it("rejects runtime claims and malformed immutable sources", () => {
    const bad = fixture();
    bad.runtime = { runner: "microduck-standard-v1" };
    expect(PolicySchema.safeParse(bad).success).toBe(false);
    const unsafePath = fixture();
    unsafePath.source.artifact_path = "../policy.onnx";
    expect(PolicySchema.safeParse(unsafePath).success).toBe(false);
    const unsafeRevision = fixture();
    unsafeRevision.source.revision = "main";
    expect(PolicySchema.safeParse(unsafeRevision).success).toBe(false);
    const mismatchedManifest = fixture();
    mismatchedManifest.source.manifest_path = "manifest.json";
    expect(PolicySchema.safeParse(mismatchedManifest).success).toBe(false);
  });

  it("rejects unknown nested curation fields", () => {
    const bad = fixture();
    bad.curation.unexpected = true;
    expect(PolicySchema.safeParse(bad).success).toBe(false);
  });
});
