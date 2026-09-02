# Registry simulation (`simulation/`)

The registry runner produces a deterministic diagnostic rollout and review
media for policies that explicitly opt into its constrained environment. A
render is not hardware verification and does not reproduce arbitrary publisher
training environments.

## Recipe model

Simulation is independent from `compatibility.robotd_slot`:

```json
"simulation": {
  "runner": "microduck-standard-v1",
  "scene": "flat-v1",
  "start": { "preset": "standing_pose" },
  "scenario": "velocity",
  "duration_s": 6,
  "checks": ["no_fall", "ends_upright", "velocity_tracking"],
  "segments": [
    { "duration_s": 1, "vx": 0, "vy": 0, "wz": 0 },
    { "duration_s": 3, "vx": 0.25, "vy": 0, "wz": 0 },
    { "duration_s": 2, "vx": 0, "vy": 0, "wz": 0 }
  ]
}
```

- `scene` is persistent world geometry. V1 supports only the registry-owned
  `flat-v1` scene; a rough-terrain policy rendered there is only a flat-world
  diagnostic.
- `model` selects the pinned robot asset variant and must match the behavior's
  compatibility model. It defaults to that compatibility model; V1 supports
  `microduck-standard` and the official `microduck-rollers` model.
- `start` is the robot state at time zero. V1 supports the raw
  `standing_pose` (contact is not implied), `settled_standing`, and a bounded
  `airborne_drop` preset. An airborne reset is reported as such and is not
  counted as takeoff.
- `scenario` is the command schedule: `velocity`, `standing`, `sitstand`,
  `oneshot_phase`, `oneshot_zero`, or `oneshot_trigger`.
- `checks` selects runner-defined assertions. Descriptors cannot provide check
  prose or results.

Before downloading a policy or starting MuJoCo, the runner performs a
deterministic admission check. It verifies the declared contract, model, scene,
start preset, scenario, and command schedule. Velocity schedules must be
explicit, cover the rollout exactly, and stay within the runner's supported
command range. A recipe that does not fit is rejected; command values are
never silently clipped or replaced with a default.

If the policy requires custom assets, a different observation/action contract,
or a publisher-specific environment, declare that boundary instead of adding
code to the registry runner:

```json
"simulation": {
  "runner": "external",
  "reason": "custom_environment",
  "notes": "Uses the publisher's obstacle scene."
}
```

Having the fixed 61D/14D ONNX contract is not enough for admission: the
command protocol and environment must also be represented. Do not give CI a
convenient but inaccurate command schedule just so the policy can be rendered.
If the policy's command protocol or environment is not supported, use
`external` until it has a matching runner profile.

Omitting `simulation` is also valid and produces an unsupported/no-recipe CI
report when that descriptor changes.

## What the report says

Top-level execution is one of `rendered`, `unsupported`, `rejected`, or
`failed`. A rendered report includes exact observations and individual check
outcomes. It never emits a general policy-validation or hardware-validation
claim.

The report also records the preflight status and any runtime-fidelity warnings,
such as a descriptor declaring BAM actuator dynamics while the registry runner
uses its deterministic position-control diagnostic model. That warning does not
turn a render into a reproduction claim.

Baseline numerical-integrity and bounded-drift checks always run. Requested
checks may additionally cover falls, final posture, velocity tracking,
supported takeoff, and bilateral touchdown after takeoff. A failing requested
check fails CI only after the report and media have been produced for review.

## Usage and outputs

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r simulation/requirements.txt   # + system: libegl1, ffmpeg
python simulation/run_check.py --behavior alpha-walking --keep-media --out sim-results
```

Outputs under `sim-results/<id>/`:

| File | Meaning |
| --- | --- |
| `report.json` | Execution status, recipe, observations, checks, and provenance |
| `loop.mp4` | 512×512 H.264, 30 fps, muted diagnostic rollout |
| `poster.png` | 512×512 midpoint frame with an inset caption bar |

Exit code 0 means rendered checks passed or the recipe is explicitly
unsupported; 1 means a requested check failed; 2 means preflight rejected the
recipe or execution failed.

After human review, a maintainer may deliberately publish one result to the
site:

```bash
python simulation/publish_result.py sim-results/alpha-walking
```

Publisher media is never replaced. Published registry renders are used as card
and hero fallbacks when publisher media is absent, and otherwise appear in a
separate **Registry simulation** section on the behavior page.

## CI isolation

- A changed descriptor runs only that behavior.
- Shared runner/schema/workflow changes run the fixed golden set:
  `alpha-walking`, `jump`, `max-height-jump`, and `roulade`.
- A full-catalog run is manual through `workflow_dispatch`.
- Artifacts are retained for 14 days and are not automatically published.

Fork PRs use read-only permissions, no secrets, and the `pull_request` event.
The runner does not execute contributor Python, install per-policy dependencies,
or accept contributor-provided scenes.

## Render and runtime standard

- MuJoCo EGL offscreen renderer, square 512×512 H.264 `yuv420p`, 30 fps;
- fixed smoothed chase camera and registry-owned visual stage;
- pinned official Microduck MJCF variant and deterministic CPU rollout;
- 50 Hz control, decimation 4, 61 observations, and 14 actions.

The runtime is a constrained compatibility aid. Publisher footage and external
evaluation remain the source of truth for environments the runner does not own.
