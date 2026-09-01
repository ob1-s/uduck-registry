# CI simulation + render check: viability assessment

**Verdict: viable, built, and validated.** Branch `feat/ci-sim-render`.

## What was built

- `simulation/` — headless Microduck policy runtime (Python, MuJoCo + onnxruntime),
  hash-pinned upstream assets, command profiles, pass/fail checks, and a
  deterministic 512x512 H.264 render loop + poster generator.
- `.github/workflows/sim-check.yml` — PR-gated workflow: detects changed
  descriptors, runs one sim job per behavior, uploads report + render artifacts,
  writes a job summary. Fails the PR on an unsafe or non-running policy.
- Optional `simulation` descriptor block (JSON Schema + zod) to pin a command
  profile per behavior.

## Ground truth chain

The official Pollen simulator (HF Space `microduck-simulator`) runs the exact
stack we need: MuJoCo physics + onnxruntime-web policies at 50 Hz, decimation 4,
61D obs = gyro(3) + projected gravity(3) + joint pos rel(14) + joint vel(14) +
last action(14) + command(13). The canonical reference is
`pollen-robotics/microduck_rl` `scripts/infer_policy.py` (Rust `robotd` on the
robot mirrors the same contract). The Space's MJCF (`robot_allcollisions.xml`)
is byte-identical to the one in `microduck_rl`.

## Validation performed

1. **Obs-level**: our port's 61D observation at reset matches upstream
   `PolicyInference.get_observations()` exactly (max abs diff 0.0, same scene,
   same ONNX).
2. **Trajectory-level**: driving both the unmodified upstream reference script
   and our runtime with `BEST_alpha_walking.onnx`, cmd vx=0.25, 8 s:
   upstream 0.8376 m total / 0.1011 m last-second; ours 0.8133 m / 0.1040 m
   (~3% float-ordering drift). Runtime is a faithful port.
3. **Golden-reference limits**: `max-height-jump` (author-documented 0.628 m/s
   launch, 31.67 mm rise) does not launch under the standard profile with any
   simple trigger encoding we tried (max 0.208 m/s at the XML's 125 Hz default).
   The author's bespoke eval protocol is not recoverable from the descriptor
   alone — this is exactly what the `simulation` block is for. Checks are
   calibrated to "runs safely under the standard contract", not to reproducing
   author setups.
4. **Rendering**: EGL software rendering works headless (this box has no GPU);
   GH ubuntu runners support the same via `libegl1`. ffmpeg encodes the loop.

## Findings that matter

- The registry contract is fixed at 61 observations (including the unified 13D
  command) and 14 actions. The runtime accepts a dynamic batch axis but rejects
  artifacts whose feature or action dimensions do not match that contract.
- Deterministic CPU sim under-reports locomotion speed vs hardware claims
  (~40-50% of commanded vx for the official walk policy with a step command).
  Tracking checks verify direction + a minimum fraction, not equality.
- Policy behavior is highly sensitive to the exact command protocol (sitstand
  flag, phase-encoded one-shots, kick windows). The profiles encode the
  documented upstream semantics (from `constants.js`/`infer_policy.py`).

## China / restricted-region angle

Sim-rendered loops are generated in CI and uploaded as workflow artifacts for
review. The current workflow does not commit them under `public/media/sim/`,
publish them to uduckmoves.com, or update descriptors automatically. Original
author media remains canonical and preferred where available (mirrored via the
existing `remote-cache`). Deciding whether and how to publish generated renders
is a separate integration step.

## Costs

- Per-behavior sim job: ~1-2 min on ubuntu-latest (assets cached by lock hash;
  6 s rollout ≈ 300 control steps + 150 renders). Worst case (a PR touching all
  descriptors) runs the matrix in parallel.
- No GPU, no HF compute, no upstream permission needed (Apache-2.0 assets,
  hash-pinned, attributed).
