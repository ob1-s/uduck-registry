import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { formatStatusBadge, parsePullArgs } from "../scripts/cli";
import {
  createSubmissionBranch,
  fetchWithTimeout,
  githubFetch,
  main as submit,
  validateSubmissionCandidate,
} from "../scripts/submit";
import { BehaviorSchema } from "../registry/schema/behavior";

const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "uduck-cli-submit-"));

afterAll(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});

function stripAnsi(value: string): string {
  return value.replace(/\x1b\[[0-9;]*m/g, "");
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("CLI status and artifact UX", () => {
  it("uses a truthful badge for every verification status", () => {
    expect(stripAnsi(formatStatusBadge("verified_hardware"))).toBe("[HARDWARE]");
    expect(stripAnsi(formatStatusBadge("claimed_hardware"))).toBe("[CLAIMED]");
    expect(stripAnsi(formatStatusBadge("community_experimental"))).toBe("[EXPERIMENTAL]");
  });

  it("parses an optional destination for pull", () => {
    expect(parsePullArgs(["genesis-velocity"])).toMatchObject({
      id: "genesis-velocity",
      destDir: "./policies",
    });
    expect(parsePullArgs(["genesis-velocity", "./tmp"])).toMatchObject({
      id: "genesis-velocity",
      destDir: "./tmp",
    });
  });
});

describe("submission remediation", () => {
  it("reports malformed JSON as a clean nonzero failure", async () => {
    const file = path.join(tempDir, "malformed.json");
    fs.writeFileSync(file, "{\"id\":");

    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(submit([file])).resolves.toBe(1);
      expect(error.mock.calls.flat().join(" ")).toMatch(/invalid JSON/i);
      expect(error.mock.calls.flat().join(" ")).not.toMatch(/SyntaxError/);
    } finally {
      error.mockRestore();
    }
  });

  it("rejects a candidate whose id is already in the full registry", () => {
    const raw = fs.readFileSync("registry/behaviors/alpha-walking.json", "utf8");
    const parsed = BehaviorSchema.parse(JSON.parse(raw));
    const result = validateSubmissionCandidate(parsed);
    expect(result.valid).toBe(false);
    expect(result.errors.join("\n")).toMatch(/alpha-walking.*already exists/i);
  });

  it("returns status 1 when manual instructions are printed instead of a PR", async () => {
    const candidate = JSON.parse(fs.readFileSync("registry/behaviors/genesis-velocity.json", "utf8"));
    candidate.id = "manual-submit-test";
    candidate.name = "Manual Submit Test";
    const file = path.join(tempDir, "manual-submit-test.json");
    fs.writeFileSync(file, JSON.stringify(candidate));

    const oldRepo = process.env.UDUCK_REPO;
    const oldToken = process.env.GITHUB_TOKEN;
    const oldClientId = process.env.UDUCK_CLIENT_ID;
    process.env.UDUCK_REPO = "owner/registry";
    delete process.env.GITHUB_TOKEN;
    delete process.env.UDUCK_CLIENT_ID;
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      await expect(submit([file])).resolves.toBe(1);
      const output = [...log.mock.calls, ...error.mock.calls].flat().join(" ");
      expect(output).toMatch(/manual fallback/i);
      expect(output).toMatch(/no PR was created/i);
      expect(output).toMatch(/status 1/i);
    } finally {
      if (oldRepo === undefined) delete process.env.UDUCK_REPO;
      else process.env.UDUCK_REPO = oldRepo;
      if (oldToken === undefined) delete process.env.GITHUB_TOKEN;
      else process.env.GITHUB_TOKEN = oldToken;
      if (oldClientId === undefined) delete process.env.UDUCK_CLIENT_ID;
      else process.env.UDUCK_CLIENT_ID = oldClientId;
      log.mockRestore();
      error.mockRestore();
    }
  });

  it("times out a stalled GitHub request", async () => {
    const stalledFetch: typeof fetch = async (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });

    await expect(fetchWithTimeout("https://api.github.com/user", {}, 5, stalledFetch)).rejects.toThrow(/timed out/i);
  });

  it("turns a successful HTTP response with invalid JSON into a readable error", async () => {
    const badJsonFetch: typeof fetch = async () => new Response("not-json", { status: 200 });
    await expect(githubFetch("https://api.github.com/user", "token", {}, badJsonFetch)).rejects.toThrow(/invalid JSON/i);
  });

  it("retries branch creation after an existing/racing branch collision", async () => {
    const createdBranches: string[] = [];
    const existingBranches = new Set<string>();
    const collisionFetch: typeof fetch = async (input, init) => {
      const url = String(input);
      if (url.endsWith("/git/ref/heads/main")) {
        return jsonResponse({ object: { sha: "base-sha" } });
      }

      const branchMatch = url.match(/\/git\/ref\/heads\/([^/?]+)$/);
      if (branchMatch) {
        const branch = decodeURIComponent(branchMatch[1]);
        return existingBranches.has(branch)
          ? jsonResponse({ ref: `refs/heads/${branch}` })
          : jsonResponse({ message: "Not Found" }, 404);
      }

      if (url.endsWith("/git/refs") && init?.method === "POST") {
        const body = JSON.parse(String(init.body)) as { ref: string };
        const branch = body.ref.replace(/^refs\/heads\//, "");
        createdBranches.push(branch);
        if (createdBranches.length === 1) return jsonResponse({ message: "already exists" }, 422);
        existingBranches.add(branch);
        return jsonResponse({ ref: body.ref }, 201);
      }

      throw new Error(`unexpected URL: ${url}`);
    };

    const branch = await createSubmissionBranch("alice/registry", "main", "demo", "token", collisionFetch);
    expect(createdBranches).toHaveLength(2);
    expect(new Set(createdBranches).size).toBe(2);
    expect(branch).toBe(createdBranches[1]);
  });
});
