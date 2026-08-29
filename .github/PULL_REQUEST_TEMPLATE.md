<!-- uDuck Registry behavior submission -->

## What this PR does
<!-- New behavior / tier change / artifact re-vendor / infra. One line each. -->

## Submission checklist (see CONTRIBUTING.md)
- [ ] `pnpm validate` passes locally (schema + contract 61-D obs / 14 joints / 50 Hz)
- [ ] Artifact checked with `pnpm vendor` — sha256 + size recorded; the local cache is optional
- [ ] `pnpm compile` run; `public/registry.json` snapshot committed (CI snapshot-diffs this)
- [ ] Tier claimed honestly: `verified_simulation` is computed by MuJoCo CI on this PR — it is never inherited and never self-declared
- [ ] `license` field accurate; NC-licensed assets are **linked, not hosted**, unless cleared in NOTICE terms
- [ ] Community work is not presented as official Pollen Robotics work
- [ ] No secrets or executable content in behavior metadata; artifact URLs use the allowlist (huggingface.co, raw.githubusercontent.com)

## For maintainers (tier changes)
- [ ] If claiming `verified_simulation`, the tier is recomputed fresh on the submitted artifact bytes
- [ ] Hardware attestations reference a PR with committed video + logs — never a textbox

🦆 CI uploads simulation records for maintainer review.
