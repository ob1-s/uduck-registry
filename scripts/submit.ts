#!/usr/bin/env tsx
/**
 * `pnpm cli submit <behavior.json>` — submit a behavior to the registry via GitHub PR.
 *
 * The command validates the candidate and the current registry before it talks
 * to GitHub. Authentication/API failures print a manual path, but still return
 * a failure status so callers cannot mistake guidance for a created PR.
 */
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { BehaviorSchema, type Behavior } from "../registry/schema/behavior";
import { validateAllBehaviors } from "./validate-registry";

const GITHUB_API = "https://api.github.com";
const DEFAULT_HTTP_TIMEOUT_MS = 15_000;
const FORK_READY_TIMEOUT_MS = 30_000;
const FORK_POLL_INTERVAL_MS = 2_000;
const BRANCH_ATTEMPTS = 5;
const REPO_PART = /^[A-Za-z0-9_.-]+$/;

type FetchImplementation = typeof fetch;

interface DeviceCodeResponse {
  device_code?: string;
  user_code?: string;
  verification_uri?: string;
  interval?: number;
  expires_in?: number;
}

interface DeviceTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

export class GitHubRequestError extends Error {
  constructor(public readonly status: number, body: string) {
    super(`GitHub API ${status}${body ? `: ${body.slice(0, 300)}` : ""}`);
    this.name = "GitHubRequestError";
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function positiveEnv(name: string, fallback: number): number {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function httpTimeoutMs(): number {
  return positiveEnv("UDUCK_HTTP_TIMEOUT_MS", DEFAULT_HTTP_TIMEOUT_MS);
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = httpTimeoutMs(),
  fetchImpl: FetchImplementation = fetch,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = init.signal ? AbortSignal.any([init.signal, controller.signal]) : controller.signal;

  try {
    return await fetchImpl(url, { ...init, signal });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error(`Request timed out after ${timeoutMs} ms: ${url}`);
    }
    throw new Error(`Request failed for ${url}: ${errorMessage(error)}`);
  } finally {
    clearTimeout(timer);
  }
}

async function responseBody(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

async function parseResponseJson<T>(response: Response, context: string): Promise<T> {
  const body = await responseBody(response);
  if (!response.ok) {
    throw new GitHubRequestError(response.status, body);
  }
  if (!body.trim()) {
    return null as T;
  }
  try {
    return JSON.parse(body) as T;
  } catch {
    throw new Error(`${context} returned invalid JSON (HTTP ${response.status}).`);
  }
}

export async function githubFetch<T = unknown>(
  url: string,
  token: string,
  init: RequestInit = {},
  fetchImpl: FetchImplementation = fetch,
): Promise<T> {
  const response = await fetchWithTimeout(
    url,
    {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    },
    httpTimeoutMs(),
    fetchImpl,
  );
  return parseResponseJson<T>(response, "GitHub API");
}

/** Device flow: request a code, poll for the token (public_repo scope only). */
export async function deviceFlowAuth(clientId: string, fetchImpl: FetchImplementation = fetch): Promise<string> {
  const start = await fetchWithTimeout(
    "https://github.com/login/device/code",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, scope: "public_repo" }),
    },
    httpTimeoutMs(),
    fetchImpl,
  );
  const startData = await parseResponseJson<DeviceCodeResponse>(start, "GitHub device-code response");

  if (!startData?.device_code || !startData.user_code || !startData.verification_uri) {
    throw new Error("GitHub device-code response was missing required fields.");
  }

  console.log(`\n\x1b[1mOpen:\x1b[0m  ${startData.verification_uri}`);
  console.log(`\x1b[1mEnter:\x1b[0m ${startData.user_code}\n`);

  const intervalMs = Math.max(1_000, (startData.interval ?? 5) * 1_000);
  const expiresIn = startData.expires_in && startData.expires_in > 0 ? startData.expires_in : 900;
  const deadline = Date.now() + expiresIn * 1_000;
  let pollIntervalMs = intervalMs;

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, Math.min(pollIntervalMs, deadline - Date.now())));
    if (Date.now() >= deadline) break;

    const poll = await fetchWithTimeout(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          device_code: startData.device_code,
          grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        }),
      },
      httpTimeoutMs(),
      fetchImpl,
    );
    const data = await parseResponseJson<DeviceTokenResponse>(poll, "GitHub device-token response");
    if (data?.access_token) return data.access_token;
    if (data?.error === "authorization_pending") continue;
    if (data?.error === "slow_down") {
      pollIntervalMs += 5_000;
      continue;
    }
    throw new Error(`Device flow failed: ${data?.error_description || data?.error || "unknown response"}`);
  }

  throw new Error("Device flow timed out");
}

export function parseGithubRepo(value: string): string | null {
  const cleaned = value.trim().replace(/\.git$/i, "");
  const parts = cleaned.split("/");
  if (parts.length !== 2 || !REPO_PART.test(parts[0]) || !REPO_PART.test(parts[1])) return null;
  return `${parts[0]}/${parts[1]}`;
}

export function resolveRepo(): string | null {
  if (process.env.UDUCK_REPO !== undefined) {
    return parseGithubRepo(process.env.UDUCK_REPO);
  }

  try {
    const origin = execFileSync("git", ["remote", "get-url", "origin"], { encoding: "utf-8" }).trim();
    const match = origin.match(/github\.com(?::|\/)([^/\s]+)\/([^/\s]+?)(?:\.git)?$/i);
    return match ? parseGithubRepo(`${match[1]}/${match[2]}`) : null;
  } catch {
    return null;
  }
}

export function makeSubmissionBranch(behaviorId: string): string {
  return `uduck-submit-${behaviorId}-${crypto.randomBytes(4).toString("hex")}`;
}

export function manualFallback(
  raw: string,
  behaviorId: string,
  repo: string | null,
  reason: string,
  existingBranch?: string,
): number {
  const branch = existingBranch ?? makeSubmissionBranch(behaviorId);
  console.error(`\n\x1b[33mAutomatic submission unavailable (${reason}).\x1b[0m`);
  console.log("Manual fallback — no PR was created, so this command exits with status 1.\n");

  if (repo) {
    const [, name] = repo.split("/");
    console.log(`  1. Fork https://github.com/${repo}`);
    console.log(`  2. Create a unique branch named ${branch} in your fork.`);
    console.log(`  3. Add your behavior file to registry/behaviors/${behaviorId}.json.`);
    console.log("  4. Open a PR from that branch:");
    console.log(`     https://github.com/${repo}/compare/main...<your-user>:${name}:${branch}?expand=1`);
  } else {
    console.log("  Set UDUCK_REPO=owner/name, fork the registry, and open a PR from a unique branch.");
  }

  console.log("\n  Validated behavior JSON follows — attach it to the PR:\n");
  console.log(raw);
  return 1;
}

export interface SubmissionValidation {
  valid: boolean;
  errors: string[];
}

export function validateSubmissionCandidate(behavior: Behavior): SubmissionValidation {
  const registry = validateAllBehaviors();
  const errors = [...registry.errors];
  if (registry.behaviors.some((item) => item.id === behavior.id)) {
    errors.push(`Behavior ID '${behavior.id}' already exists in registry/behaviors/.`);
  }
  return { valid: errors.length === 0, errors };
}

export async function createSubmissionBranch(
  fork: string,
  defaultBranch: string,
  behaviorId: string,
  token: string,
  fetchImpl: FetchImplementation = fetch,
): Promise<string> {
  const base = await githubFetch<{ object?: { sha?: string } }>(
    `${GITHUB_API}/repos/${fork}/git/ref/heads/${encodeURIComponent(defaultBranch)}`,
    token,
    {},
    fetchImpl,
  );
  const baseSha = base?.object?.sha;
  if (!baseSha) throw new Error(`GitHub returned no base commit for ${defaultBranch}.`);

  let lastCollision = "unknown collision";
  for (let attempt = 0; attempt < BRANCH_ATTEMPTS; attempt++) {
    const branch = makeSubmissionBranch(behaviorId);
    const branchRef = `${GITHUB_API}/repos/${fork}/git/ref/heads/${encodeURIComponent(branch)}`;

    try {
      await githubFetch(branchRef, token, {}, fetchImpl);
      lastCollision = `${branch} already exists`;
      continue;
    } catch (error) {
      if (!(error instanceof GitHubRequestError) || error.status !== 404) throw error;
    }

    try {
      await githubFetch(`${GITHUB_API}/repos/${fork}/git/refs`, token, {
        method: "POST",
        body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: baseSha }),
      }, fetchImpl);
      return branch;
    } catch (error) {
      if (error instanceof GitHubRequestError && error.status === 422) {
        lastCollision = `${branch} was created concurrently`;
        continue;
      }
      throw error;
    }
  }

  throw new Error(`Could not create a collision-free submission branch after ${BRANCH_ATTEMPTS} attempts (${lastCollision}).`);
}

interface LoadedBehavior {
  raw: string;
  behavior: Behavior;
}

function loadBehavior(sourcePath: string): LoadedBehavior | { error: string } {
  let raw: string;
  try {
    raw = fs.readFileSync(sourcePath, "utf-8");
  } catch (error) {
    return { error: `Could not read behavior file '${sourcePath}': ${errorMessage(error)}` };
  }

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    return { error: `Behavior file '${sourcePath}' contains invalid JSON: ${errorMessage(error)}` };
  }

  const parsed = BehaviorSchema.safeParse(value);
  if (!parsed.success) {
    return {
      error: `Behavior JSON failed validation — fix these before submitting:\n${JSON.stringify(parsed.error.format(), null, 2)}`,
    };
  }
  return { raw, behavior: parsed.data };
}

async function waitForFork(fork: string, token: string, fetchImpl: FetchImplementation): Promise<string> {
  const deadline = Date.now() + FORK_READY_TIMEOUT_MS;
  let lastError: unknown;

  while (Date.now() < deadline) {
    try {
      const result = await githubFetch<{ default_branch?: string }>(`${GITHUB_API}/repos/${fork}`, token, {}, fetchImpl);
      if (!result?.default_branch) throw new Error("GitHub fork response was missing default_branch.");
      return result.default_branch;
    } catch (error) {
      lastError = error;
      if (!(error instanceof GitHubRequestError) || error.status !== 404) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, Math.min(FORK_POLL_INTERVAL_MS, deadline - Date.now())));
  }

  throw new Error(`Timed out waiting for fork ${fork} to become available: ${errorMessage(lastError)}`);
}

function printSubmitHelp() {
  console.log(`Usage: pnpm cli submit <path/to/behavior.json>

The candidate and the complete current registry are validated before GitHub authentication.
Authentication/API failures print manual instructions and return status 1.`);
}

export async function main(argv: string[] = process.argv.slice(2)): Promise<number> {
  const sourcePath = argv[0];
  if (sourcePath === "--help" || sourcePath === "-h") {
    printSubmitHelp();
    return 0;
  }
  if (!sourcePath) {
    console.error("Error: Usage: pnpm cli submit <path/to/behavior.json>");
    return 1;
  }

  const absPath = path.resolve(sourcePath);
  const loaded = loadBehavior(absPath);
  if ("error" in loaded) {
    console.error(`\x1b[31mError: ${loaded.error}\x1b[0m`);
    return 1;
  }

  let validation: SubmissionValidation;
  try {
    validation = validateSubmissionCandidate(loaded.behavior);
  } catch (error) {
    console.error(`\x1b[31mError: full registry validation could not run: ${errorMessage(error)}\x1b[0m`);
    return 1;
  }
  if (!validation.valid) {
    console.error("\x1b[31mError: full registry validation failed; submission was not attempted.\x1b[0m");
    console.error(validation.errors.join("\n"));
    return 1;
  }
  const { raw, behavior } = loaded;
  console.log(`\x1b[32m✓ ${behavior.id} passes candidate and full-registry validation.\x1b[0m`);

  const repo = resolveRepo();
  if (!repo) {
    return manualFallback(raw, behavior.id, null, "could not determine a valid GitHub repo; set UDUCK_REPO=owner/name");
  }

  let token = process.env.GITHUB_TOKEN?.trim() || null;
  if (!token) {
    const clientId = process.env.UDUCK_CLIENT_ID?.trim();
    if (!clientId) {
      return manualFallback(raw, behavior.id, repo, "no OAuth client id configured (set UDUCK_CLIENT_ID) or GITHUB_TOKEN");
    }
    try {
      token = await deviceFlowAuth(clientId);
      console.log("\x1b[32m✓ Authenticated (public_repo scope only).\x1b[0m");
    } catch (error) {
      return manualFallback(raw, behavior.id, repo, errorMessage(error));
    }
  }

  let branch: string | undefined;
  try {
    const [owner, name] = repo.split("/");
    const me = await githubFetch<{ login?: string }>(`${GITHUB_API}/user`, token);
    if (!me?.login) throw new Error("GitHub user response was missing login.");
    console.log(`✓ Signed in as ${me.login}`);

    await githubFetch(`${GITHUB_API}/repos/${owner}/${name}/forks`, token, { method: "POST" });
    const fork = parseGithubRepo(`${me.login}/${name}`);
    if (!fork) throw new Error("GitHub returned an unsafe login/repository name.");
    console.log(`✓ Fork ready: ${fork}`);

    const defaultBranch = await waitForFork(fork, token, fetch);
    branch = await createSubmissionBranch(fork, defaultBranch, behavior.id, token);
    console.log(`✓ Unique branch ${branch} created`);

    await githubFetch(
      `${GITHUB_API}/repos/${fork}/contents/registry/behaviors/${encodeURIComponent(behavior.id)}.json`,
      token,
      {
        method: "PUT",
        body: JSON.stringify({
          message: `behavior: add ${behavior.id} v${behavior.version}`,
          content: Buffer.from(raw, "utf-8").toString("base64"),
          branch,
        }),
      },
    );
    console.log(`✓ registry/behaviors/${behavior.id}.json committed`);

    const pr = await githubFetch<{ html_url?: string }>(`${GITHUB_API}/repos/${owner}/${name}/pulls`, token, {
      method: "POST",
      body: JSON.stringify({
        title: `behavior: ${behavior.name} (${behavior.id} v${behavior.version})`,
        head: `${me.login}:${branch}`,
        base: defaultBranch,
        body: PR_BODY,
      }),
    });
    if (!pr?.html_url) throw new Error("GitHub PR response was missing html_url.");
    console.log(`\n\x1b[32m🦆 PR opened: ${pr.html_url}\x1b[0m`);
    console.log("CI will validate the descriptor and rebuild the catalog on this PR.");
    return 0;
  } catch (error) {
    return manualFallback(raw, behavior.id, repo, errorMessage(error), branch);
  }
}

const PR_BODY = [
  "## Behavior submission checklist",
  "",
  "- [x] Candidate and full registry: pass `pnpm validate` (61-D obs, 14 joints, 50 Hz contract)",
  "- [ ] Artifact: canonical ONNX URL and metadata are correct",
  "- [ ] Verification label and hardware requirements are accurate",
  "- [ ] License: stated; upstream assets are linked, not hosted",
].join("\n");

if (process.argv[1]?.endsWith("submit.ts")) {
  void main().then((code) => {
    process.exitCode = code;
  }).catch((error: unknown) => {
    console.error(`\x1b[31m${errorMessage(error)}\x1b[0m`);
    process.exitCode = 1;
  });
}
