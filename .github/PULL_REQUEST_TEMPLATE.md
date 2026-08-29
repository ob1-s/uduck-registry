<!-- uDuck Registry behavior submission -->

## What this PR does
<!-- New behavior / tier change / artifact re-vendor / infra. One line each. -->

## Submission checklist (see CONTRIBUTING.md)
- [ ] `pnpm validate` passes locally (schema + contract 61-D obs / 14 joints / 50 Hz)
- [ ] ONNX vendored: `pnpm tsx scripts/vendor-artifacts.ts` — sha256 + size recorded, bytes in `vendor/policies/<id>.onnx`
- [ ] `pnpm compile` run; `public/registry.json` snapshot committed (CI snapshot-diffs this)
- [ ] Tier claimed honestly: `sim_verified` is computed by MuJoCo CI on this PR — it is never inherited and never self-declared
- [ ] `license` field accurate; NC-licensed assets are **linked, not hosted**, unless cleared in NOTICE terms
- [ ] Not claiming the `@pollen` namespace unless you are Pollen Robotics (CODEOWNERS enforces review)
- [ ] No secrets, no network calls in behavior metadata; artifact URLs on the allowlist (huggingface.co, raw.githubusercontent.com) only

## For maintainers (tier changes)
- [ ] Tier recomputed fresh on these artifact bytes (hash in `sim_verification` matches vendored file)
- [ ] Hardware attestations reference a PR with committed video + logs — never a textbox

🦆 CI will comment with sim results.
