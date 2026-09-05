<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Registry contribution work

Read [CONTRIBUTING.md](CONTRIBUTING.md). Prefer a Pollen Hub package URL through the issue form or `pnpm uduck register <URL>`.

- `registry/policies/*.json` is authored pointer + curation state. `registry/behaviors/` is the legacy/manual path.
- One public shape: `CatalogEntry`. No `/policies` routes; Flamingo lives at `/behaviors/flamingo-cycle`.
- Do not guess normalizers, action scales, runtime slots, hardware evidence, or command values.
- `.generated/`, public indexes, and registry renders are build outputs. Do not commit them.
- ONNX inspection is not a behavior simulation. Upstream `eval` and author media are publisher claims.
- Execution identity v2 covers execution-relevant inputs only; curation edits must not rerun simulation. Evidence blobs are content-addressed (`<blob>.tar.gz`).
- Run `pnpm validate`, resolver tests, and relevant TypeScript/Python tests for tooling changes.
