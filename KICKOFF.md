# uDuck Registry — v0.1 Kickoff (swarm handoff)

Hi coordinator. You inherit a working registry + a red-teamed plan. Build the v0.1 slice below. Don't rebuild what exists.

## TLDR state of repo
- **What it is**: registry of 16 RL locomotion policies (ONNX) for Pollen Robotics' MicroDuck. `registry/behaviors/*.json` = source of truth, zod schema (`registry/schema/behavior.ts`, contract: 61-D obs, 14 joints, 50 Hz). `pnpm validate` → `pnpm compile` → `public/registry.json` → Next.js static export (`output: "export"`) → Cloudflare Pages **direct-upload** (live at https://uduck-registry.pages.dev, deploy = `wrangler pages deploy out --project-name uduck-registry`, logged in).
- **CLI**: `pnpm cli` — list / info / toml / pull (prints curl, doesn't fetch yet) / validate.
- **Site**: full MicroDuck identity redesign, looping video thumbnails (8 moves). Committed on `main`.
- **⚠️ NO GIT REMOTE. Everything is local-only.** Ask user for repo URL, or at minimum back up.
- **Tests**: 5/5 vitest. CI workflow exists (`.github/workflows/ci.yml`).

## The plan (v0.1 = "hardened slice" only)
GitHub-as-Hub: PRs from any GitHub account = authed-permissionless submission; CI = verification. Inspired by shadcn (static federated JSON) + Prime Intellect Environments Hub (CLI-first, authed publishing, actions-on-push) — but our differentiator: **we can roll out the actual policy in MuJoCo in CI**, which neither can.

Build, in order:
1. **Artifact integrity**: vendor ONNX into repo (Git LFS or mirror) at merge time; `sha256` + byte size in schema; host allowlist (hf.co, raw.githubusercontent.com only, HTTPS); `uduck pull` actually downloads + verifies hash (hash the bytes written, validate `<owner>/<id>` against `^[a-zA-Z0-9-_]+$` before any fs use).
2. **`uduck add/submit` → PR flow**: fork/branch/commit/open-PR via GitHub device-flow auth, `public_repo` scope only, manual-fallback prefilled PR URL on auth failure. `uduck validate` must be byte-identical to CI's checks. PR template with schema checklist.
3. **`sim_verified` CI tier**: headless MuJoCo rollout of ONNX vs official MJCF (pin MJCF **hash** in the verification record), graded on travel/fall/stability, fixed seeds, MuJoCo version pinned by digest. Sandboxing is NON-NEGOTIABLE: `pull_request` event (never `_target`), no secrets on PR jobs, networkless container, actions pinned by commit SHA, ONNX op-allowlist + graph-size caps. Tier recomputed on every artifact-byte change (never inherited).
4. **LICENSE/NOTICE**: `microduck_rl` code = Apache-2.0, but **3D model files = CC BY-SA-NC** (non-commercial). Our sim verification depends on the MJCF. Write NOTICE untangling this; ask Pollen for written clarification. Link-not-host anything NC-licensed unless cleared.
5. **Trust ladder** (schema-ready now, UI later): `submitted` < `sim_verified` < `hardware_verified` (attestation = PR with committed video+logs, never a textbox).

## Do NOT build yet (red-team verdict: premature)
- ❌ Auto-sync bot for Pollen upstreams (HF Space is a Gradio app — the file-listing target is unconfirmed; do a 1-day spike only)
- ❌ Namespaced IDs UI / directory page / tier sort badges (16 entries; polish after ≥5 real external submissions)
- ❌ Any server/platform infra. GitHub + Pages + Actions is the hub.

## Known traps (from swarm red-team)
- Hash-pinning a *mutable* URL = false security → vendor artifacts (that's why it's step 1)
- Zod coerces by default → `.strict()`, no coercion, snapshot-diff `registry.json` in CI
- Reserve `@pollen` namespace via CODEOWNERS before anyone squats it
- Deterministic sim grading: record seed + MuJoCo + MJCF version per verification; auto-decay stale tiers
- Zombie `next dev` on :3000; static server needs `setsid`; detail routes need `.html` on static preview

## Suggested first commands
`git status`, read `registry/schema/behavior.ts`, `scripts/*.ts`, `src/lib/registry.ts`, `pnpm validate && pnpm test`. Then start at step 1.
