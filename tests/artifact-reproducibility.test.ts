import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { getDeterministicUpdatedAt } from "../scripts/generate-registry-index";
import {
  assertSafeArtifactFilename,
  pullArtifact,
} from "../scripts/lib/pull-artifact";
import { vendorArtifacts } from "../scripts/vendor-artifacts";
import { BehaviorSchema, type Behavior } from "../registry/schema/behavior";

const BASE_BEHAVIOR = BehaviorSchema.parse(
  JSON.parse(fs.readFileSync(path.resolve("registry/behaviors/alpha-walking.json"), "utf-8")),
) as Behavior;
const ALLOWED_URL = "https://raw.githubusercontent.com/example/repo/main/policy.onnx";

const tempDirs: string[] = [];

afterEach(() => {
  vi.unstubAllGlobals();
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "uduck-artifact-test-"));
  tempDirs.push(dir);
  return dir;
}

function makeBehavior(id: string, filename = "policy.onnx", url = ALLOWED_URL): Behavior {
  const behavior = JSON.parse(JSON.stringify(BASE_BEHAVIOR)) as Behavior;
  behavior.id = id as Behavior["id"];
  behavior.artifacts.onnx.filename = filename;
  behavior.artifacts.onnx.url = url;
  delete behavior.artifacts.onnx.sha256;
  delete behavior.artifacts.onnx.size_bytes;
  return behavior;
}

function bodyResponse(bytes: Uint8Array, url: string): Response {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
  return { ok: true, status: 200, url, body } as unknown as Response;
}

function arrayBufferResponse(bytes: Uint8Array, url: string): Response {
  return {
    ok: true,
    status: 200,
    url,
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  } as unknown as Response;
}

describe("deterministic registry generation", () => {
  it("uses SOURCE_DATE_EPOCH when a release timestamp is explicitly requested", () => {
    expect(getDeterministicUpdatedAt("/tmp/does-not-exist.json", "1700000000")).toBe(
      "2023-11-14T22:13:20.000Z",
    );
  });

  it("reuses the checked-in timestamp when no release timestamp is supplied", () => {
    const snapshot = path.join(makeTempDir(), "registry.json");
    fs.writeFileSync(snapshot, JSON.stringify({ updated_at: "2024-01-02T03:04:05.000Z" }));
    const previous = process.env.SOURCE_DATE_EPOCH;
    delete process.env.SOURCE_DATE_EPOCH;
    try {
      expect(getDeterministicUpdatedAt(snapshot)).toBe("2024-01-02T03:04:05.000Z");
      expect(getDeterministicUpdatedAt(snapshot)).toBe("2024-01-02T03:04:05.000Z");
    } finally {
      if (previous === undefined) delete process.env.SOURCE_DATE_EPOCH;
      else process.env.SOURCE_DATE_EPOCH = previous;
    }
  });
});

describe("artifact path and redirect safety", () => {
  it("accepts only a single .onnx filename", () => {
    expect(() => assertSafeArtifactFilename("policy.onnx")).not.toThrow();
    for (const filename of ["../policy.onnx", "..\\policy.onnx", "/tmp/policy.onnx", "policy.bin"]) {
      expect(() => assertSafeArtifactFilename(filename)).toThrow(/filename/i);
    }
  });

  it("rejects a disallowed final redirect before creating a destination", async () => {
    const root = makeTempDir();
    const behavior = makeBehavior("redirect-test");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(bodyResponse(Buffer.from("bytes"), "https://evil.example/policy.onnx")));

    await expect(pullArtifact(behavior, path.join(root, "out"))).rejects.toThrow(/disallowed/i);
    expect(fs.existsSync(path.join(root, "out", "policy.onnx"))).toBe(false);
    expect(fs.readdirSync(path.join(root, "out"))).toHaveLength(0);
  });

  it("streams an allowlisted response and preserves exact hash/size checks", async () => {
    const root = makeTempDir();
    const bytes = Buffer.from("valid artifact bytes");
    const behavior = makeBehavior("network-test");
    behavior.artifacts.onnx.sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    behavior.artifacts.onnx.size_bytes = bytes.length;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(bodyResponse(bytes, ALLOWED_URL)));

    const result = await pullArtifact(behavior, path.join(root, "out"));
    expect(result.source).toBe("network");
    expect(result.hashMatch).toBe(true);
    expect(fs.readFileSync(result.destPath)).toEqual(bytes);
  });

  it("does not replace an existing destination when downloaded bytes fail the hash", async () => {
    const root = makeTempDir();
    const outDir = path.join(root, "out");
    fs.mkdirSync(outDir, { recursive: true });
    const destination = path.join(outDir, "policy.onnx");
    fs.writeFileSync(destination, "previous bytes");
    const behavior = makeBehavior("hash-test");
    behavior.artifacts.onnx.sha256 = "0".repeat(64);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(bodyResponse(Buffer.from("new bytes"), ALLOWED_URL)));

    await expect(pullArtifact(behavior, outDir)).rejects.toThrow(/sha256/i);
    expect(fs.readFileSync(destination, "utf-8")).toBe("previous bytes");
    expect(fs.readdirSync(outDir).filter((name) => name.includes(".part-")).length).toBe(0);
  });
});

describe("artifact vendoring", () => {
  it("does not fetch source-only records", async () => {
    const root = makeTempDir();
    const behavior = makeBehavior("source-only-test");
    behavior.discovery.status = "source_only";
    const behaviorPath = path.join(root, "registry", "behaviors", "source-only-test.json");
    fs.mkdirSync(path.dirname(behaviorPath), { recursive: true });
    fs.writeFileSync(behaviorPath, JSON.stringify(behavior, null, 2) + "\n");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await vendorArtifacts({ cwd: root });
    expect(result).toEqual({ total: 1, vendored: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("backfills metadata only after a successful allowlisted download", async () => {
    const root = makeTempDir();
    const behavior = makeBehavior("vendor-test");
    const behaviorPath = path.join(root, "registry", "behaviors", "vendor-test.json");
    fs.mkdirSync(path.dirname(behaviorPath), { recursive: true });
    fs.writeFileSync(behaviorPath, JSON.stringify(behavior, null, 2) + "\n");
    const bytes = Buffer.from("vendored artifact bytes");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(arrayBufferResponse(bytes, ALLOWED_URL)));

    const result = await vendorArtifacts({ cwd: root });
    expect(result).toEqual({ total: 1, vendored: 1, failed: 0 });
    expect(fs.readFileSync(path.join(root, "vendor", "policies", "vendor-test.onnx"))).toEqual(bytes);

    const updated = JSON.parse(fs.readFileSync(behaviorPath, "utf-8"));
    expect(updated.artifacts.onnx.sha256).toBe(crypto.createHash("sha256").update(bytes).digest("hex"));
    expect(updated.artifacts.onnx.size_bytes).toBe(bytes.length);
  });

  it("fails without writing bytes when the final redirect is outside the allowlist", async () => {
    const root = makeTempDir();
    const behavior = makeBehavior("vendor-redirect-test");
    const behaviorPath = path.join(root, "registry", "behaviors", "vendor-redirect-test.json");
    fs.mkdirSync(path.dirname(behaviorPath), { recursive: true });
    fs.writeFileSync(behaviorPath, JSON.stringify(behavior, null, 2) + "\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(arrayBufferResponse(Buffer.from("bytes"), "https://evil.example/policy.onnx")));

    const result = await vendorArtifacts({ cwd: root });
    expect(result.failed).toBe(1);
    expect(fs.existsSync(path.join(root, "vendor", "policies", "vendor-redirect-test.onnx"))).toBe(false);
  });

  it("refuses a tampered existing artifact unless --force is requested", async () => {
    const root = makeTempDir();
    const bytes = Buffer.from("expected bytes");
    const behavior = makeBehavior("vendor-tamper-test");
    behavior.artifacts.onnx.sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    behavior.artifacts.onnx.size_bytes = bytes.length;
    const behaviorPath = path.join(root, "registry", "behaviors", "vendor-tamper-test.json");
    const vendorPath = path.join(root, "vendor", "policies", "vendor-tamper-test.onnx");
    fs.mkdirSync(path.dirname(behaviorPath), { recursive: true });
    fs.mkdirSync(path.dirname(vendorPath), { recursive: true });
    fs.writeFileSync(behaviorPath, JSON.stringify(behavior, null, 2) + "\n");
    fs.writeFileSync(vendorPath, "tampered bytes");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await vendorArtifacts({ cwd: root });
    expect(result).toEqual({ total: 1, vendored: 0, failed: 1 });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(fs.readFileSync(vendorPath, "utf-8")).toBe("tampered bytes");
  });
});
