# Registry execution diagnostics

`simulation/` is a maintainer-owned, deterministic diagnostic runner. It executes only a concrete `ExecutionSpec` assembled from an authored policy, its resolved upstream manifest, and a reviewed recipe. A render is not hardware verification and does not reproduce an arbitrary publisher training or evaluation environment.

The data flow is:

```text
registry/policies/<id>.json
        ↓ resolve and verify
resolved manifest + immutable artifact
        ↓ maintainer recipe
ExecutionSpec
        ↓ preflight, download, MuJoCo rollout
report.json + optional loop.mp4/poster.png
        ↓ evidence store
content-addressed Release blob
```

## ExecutionSpec

An `ExecutionSpec` must state the entry id, exact artifact URL and SHA-256, supported model, runner contract, reviewed recipe, source identity, and resolved manifest. The current runner owns one flat `flat-v1` scene with the official 61-observation/14-action Microduck contract. Recipes state the start preset, scenario, duration, explicit schedule, checks, and provenance.

Preflight runs before download or inference. It verifies the runner, model, scene, start state, duration, schedule, contract, and HTTPS artifact URL. It rejects malformed or out-of-range commands; it never clips them and never substitutes defaults.

When no recipe covers an entry, the runner writes a report with `execution: "not-covered"` and a reason. This is visible evidence, not an escape hatch around preflight. Unsupported source environments are not run through a different execution mode.

## Usage

```bash
python3 -m venv .venv
.venv/bin/pip install -r simulation/requirements.txt
PYTHONPATH=simulation MUJOCO_GL=egl python simulation/run_check.py \
  --entry flamingo-cycle --keep-media --out sim-results
```

Outputs under `sim-results/<id>/` are:

| File | Meaning |
| --- | --- |
| `report.json` | Execution status, source, recipe, checks, and identity |
| `loop.mp4` | Registry-owned diagnostic rollout, when requested |
| `poster.png` | Registry-owned diagnostic poster, when requested |

Exit code 0 means the diagnostic passed or was not-covered; 1 means measured checks failed; 2 means preflight or execution failed. Failed and not-covered reports remain publishable so the catalog can explain the boundary.

## Evidence identity

`simulation/evidence.py` computes an entry-specific identity from the immutable source, execution-relevant manifest fields, that entry's resolved recipe/status, the executable runner code, the asset lock, dependency pins, and the environment contract. Editorial curation does not enter the digest. The evidence key additionally binds the artifact SHA-256.

The evidence store archives deterministic reports and media as `<blob_sha256>.tar.gz` assets in the `registry-evidence` GitHub Release. Its mutable index maps current entry ids to immutable blobs while retaining historical blobs. Hydration accepts only an exact current entry identity and exact authored artifact hash.

## Runtime boundary

Publisher media and evaluation may describe richer scenes, actuator models, command protocols, or hardware. Those claims remain publisher evidence. The registry runner reports only what its own stated scene, contract, recipe, and measured checks establish.
