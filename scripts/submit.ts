#!/usr/bin/env tsx
/**
 * `uduck submit <behavior.json>` — submit a behavior to the registry via GitHub PR.
 *
 * Flow (GitHub-as-Hub, authed-permissionless):
 *   1. GitHub device-flow auth (public_repo scope ONLY)
 *   2. fork the registry repo
 *   3. create a branch `uduck-submit-<id>`
 *   4. commit registry/behaviors/<id>.json
 *   5. open a PR (prefilled checklist)
 *
 * Every step degrades gracefully: on any auth/API failure we print a prefilled
 * manual PR URL so submission is NEVER a dead end.
 *
 * Configuration (no build-time secrets):
 *   UDUCK_REPO      owner/name of the registry repo (default: git remote origin)
 *   UDUCK_CLIENT_ID OAuth app client id with device flow enabled
 *   GITHUB_TOKEN    skip device flow entirely (for CI / power users)
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { BehaviorSchema } from "../registry/schema/behavior";

const GITHUB_API = "https://api.github.com";

function die(msg: string): never {
  console.error(`\x1b[31mError: ${msg}\x1b[0m`);
  process.exit(1);
}

function manualFallback(sourcePath: string, behaviorId: string, repo: string | null, reason: string) {
  const raw = fs.readFileSync(sourcePath, "utf-8");
  console.log(`\n\x1b[33mAutomatic submission unavailable (${reason}).\x1b[0m`);
  console.log(`Manual fallback — submission is never a dead end:\n`);
  console.log(`  1. Fork https://github.com/${repo ?? "<registry-repo>"}`);
  console.log(`  2. Add your behavior file to registry/behaviors/${behaviorId}.json`);
  console.log(`  3. Open a PR from your fork's main branch:\n`);
  if (repo) {
    const [owner, name] = repo.split("/");
    console.log(
      `     https://github.com/${owner}/${name}/compare/main...<your-user>:${name}:uduck-submit-${behaviorId}?expand=1`,
    );
  } else {
    console.log(`     https://github.com/<registry-owner>/<registry-repo>/compare/main...<your-branch>?expand=1`);
  }
  console.log(`\n  Validated behavior JSON follows — attach it to the PR:\n`);
  console.log(raw);
  process.exit(0);
}

async function githubFetch(url: string, token: string, init: RequestInit = {}) {
  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API ${res.status}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

/** Device flow: request a code, poll for the token (public_repo scope only). */
async function deviceFlowAuth(clientId: string): Promise<string> {
  const start = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, scope: "public_repo" }),
  });
  if (!start.ok) throw new Error(`device/code failed: HTTP ${start.status}`);
  const { device_code, user_code, verification_uri, interval = 5, expires_in = 900 } = await start.json();

  console.log(`\n\x1b[1mOpen:\x1b[0m  ${verification_uri}`);
  console.log(`\x1b[1mEnter:\x1b[0m ${user_code}\n`);
  const deadline = Date.now() + expires_in * 1000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval * 1000));
    const poll = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        device_code,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });
    const { access_token, error } = await poll.json();
    if (access_token) return access_token;
    if (error === "authorization_pending") continue;
    if (error === "slow_down") {
      await new Promise((r) => setTimeout(r, 5000));
      continue;
    }
    throw new Error(`Device flow failed: ${error}`);
  }
  throw new Error("Device flow timed out");
}

function resolveRepo(): string | null {
  if (process.env.UDUCK_REPO) return process.env.UDUCK_REPO;
  try {
    const origin = execSync("git remote get-url origin", { encoding: "utf-8" }).trim();
    const m = origin.match(/github\.com[:/](.+?\/.+?)(?:\.git)?$/);
    return m ? m[1] : null;
  } catch {
    return null;
  }
}

async function main() {
  const sourcePath = process.argv[2];
  if (!sourcePath) die("Usage: uduck submit <path/to/behavior.json>");
  const absPath = path.resolve(sourcePath);
  if (!fs.existsSync(absPath)) die(`File not found: ${absPath}`);

  const raw = fs.readFileSync(absPath, "utf-8");
  const parsed = BehaviorSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    die(`Behavior JSON failed validation — fix these before submitting:\n${JSON.stringify(parsed.error.format(), null, 2)}`);
  }
  const behavior = parsed.data;
  console.log(`\x1b[32m✓ ${behavior.id} passes the registry schema.\x1b[0m`);

  const repo = resolveRepo();
  let auth: string | null = process.env.GITHUB_TOKEN ?? null;
  if (!auth) {
    const clientId = process.env.UDUCK_CLIENT_ID;
    if (!clientId) {
      manualFallback(absPath, behavior.id, repo, "no OAuth client id configured (set UDUCK_CLIENT_ID) or GITHUB_TOKEN");
    }
    try {
      auth = await deviceFlowAuth(clientId as string);
      console.log("\x1b[32m✓ Authenticated (public_repo scope only).\x1b[0m");
    } catch (err: any) {
      manualFallback(absPath, behavior.id, repo, err.message);
    }
  }

  try {
    if (!repo) die("Could not determine the registry repo. Set UDUCK_REPO=owner/name.");
    const [owner, name] = repo.split("/");
    const me: { login: string } = await githubFetch(`${GITHUB_API}/user`, auth!);
    console.log(`✓ Signed in as ${me.login}`);

    // Fork (idempotent — returns the existing fork if present).
    await githubFetch(`${GITHUB_API}/repos/${owner}/${name}/forks`, auth!, { method: "POST" });
    const fork = `${me.login}/${name}`;
    console.log(`✓ Fork ready: ${fork}`);

    // Wait for the fork to become queryable.
    let defaultBranch = "main";
    for (let i = 0; i < 10; i++) {
      try {
        const r: { default_branch: string } = await githubFetch(`${GITHUB_API}/repos/${fork}`, auth!);
        defaultBranch = r.default_branch;
        break;
      } catch {
        await new Promise((res) => setTimeout(res, 2000));
      }
    }

    const branch = `uduck-submit-${behavior.id}`;
    const base: { object: { sha: string } } = await githubFetch(
      `${GITHUB_API}/repos/${fork}/git/ref/heads/${defaultBranch}`,
      auth!,
    );
    await githubFetch(`${GITHUB_API}/repos/${fork}/git/refs`, auth!, {
      method: "POST",
      body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: base.object.sha }),
    });
    console.log(`✓ Branch ${branch} created`);

    await githubFetch(
      `${GITHUB_API}/repos/${fork}/contents/registry/behaviors/${behavior.id}.json`,
      auth!,
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

    const pr: { html_url: string } = await githubFetch(`${GITHUB_API}/repos/${owner}/${name}/pulls`, auth!, {
      method: "POST",
      body: JSON.stringify({
        title: `behavior: ${behavior.name} (${behavior.id} v${behavior.version})`,
        head: `${me.login}:${branch}`,
        base: defaultBranch,
        body: PR_BODY,
      }),
    });
    console.log(`\n\x1b[32m🦆 PR opened: ${pr.html_url}\x1b[0m`);
    console.log("CI will run the MuJoCo sim verification and artifact checks on this PR.");
  } catch (err: any) {
    manualFallback(absPath, behavior.id, repo, err.message);
  }
}

const PR_BODY = [
  "## Behavior submission checklist",
  "",
  "- [x] Schema: passes `uduck validate` (61-D obs, 14 joints, 50 Hz contract)",
  "- [ ] Artifact: ONNX vendored with sha256 + byte size (`pnpm tsx scripts/vendor-artifacts.ts`)",
  "- [ ] Tier: claimed honestly — `sim_verified` is (re)computed by MuJoCo CI, never inherited",
  "- [ ] License: stated; NC assets are linked, not hosted, unless cleared",
  "- [ ] Namespace: not claiming `@pollen` (maintainer-only, see CODEOWNERS)",
].join("\n");

main();

