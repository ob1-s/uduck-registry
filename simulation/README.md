# CI simulation check (`simulation/`)

A headless Microduck policy runtime used by the `Sim Check` GitHub Actions
workflow. For a behavior descriptor it:

1. downloads the canonical ONNX artifact (registry artifact host allowlist only),
2. loads the pinned official Microduck MJCF (`pollen-robotics/microduck-simulator`,
   hash-pinned in `assets.lock.json`),
3. runs a deterministic MuJoCo rollout at the shared runtime contract
   (50 Hz control, decimation 4, 61D observation / 14 action),
4. evaluates pass/fail checks, and
5. renders a standardized, deterministic thumbnail loop for the catalog.

## Usage

```bash
python -m venv .venv && . .venv/bin/activate
pip install -r simulation/requirements.txt   # + system: libegl1, ffmpeg
python simulation/run_check.py --behavior alpha-walking --keep-media --out sim-results
```

Outputs under `sim-results/<id>/`:

| File | What |
| --- | --- |
| `report.json` | verdict, per-check details, metrics, policy sha256 |
| `loop.mp4` | 512x512 H.264, 30 fps, muted render loop (the thumbnail standard) |
| `poster.png` | middle frame + caption bar |

Exit code: 0 pass, 1 check failed, 2 could not run.

## Render standard

Every sim-rendered loop is identical in shape so catalog cards can treat them
uniformly (and host them from our own domain — relevant for regions where
GitHub/HF media is unreliable, e.g. mainland China):

- square 512x512, H.264 `yuv420p`, 30 fps, muted, faststart;
- fixed smoothing chase camera (side-on, −12° elevation, 0.72 m);
- rollout equals the profile duration (default 6 s);
- deterministic given the policy artifact and profile.

## Command profiles

The command schedule defaults from `compatibility.robotd_slot`:

| robotd_slot | Default profile |
| --- | --- |
| `walk`, `roller` | velocity showcase: settle → forward → arc → settle |
| `sitstand`, `stand` | sit/stand posture-flag cycle |
| `roulade` | 2 s zeroed one-shot window, falls allowed |
| `kick_left`, `kick_right` | 0.5 s zeroed one-shot window |
| `ground_pick` | phase-encoded `[cos, sin, 0]` one-shot (period 4 s, ends at 0.7) |
| `custom` | standing hold smoke check |

Descriptors can override with an optional `simulation` block:

```json
"simulation": {
  "profile": "velocity",
  "segments": [
    { "duration_s": 1, "vx": 0, "vy": 0, "wz": 0 },
    { "duration_s": 3, "vx": 0.25, "vy": 0, "wz": 0 }
  ],
  "duration_s": 4,
  "allow_fall": false,
  "expect_tracking": true
}
```

Known one-shot custom policies can use `oneshot_trigger`: it sends a short
`twist-vx = 1` launch request, then `0` for the rest of the rollout. This is
used by the published jump descriptors. The current robotd design does not
define a `jump` slot, so those descriptors correctly remain `custom`; the
profile describes their documented command semantics rather than claiming an
official slot.

`allow_fall` marks behaviors that intentionally leave the feet (roulade,
jumps): the check then requires the robot to recover upright instead of never
falling.

## What "pass" means

The verdict certifies **"the policy runs under the standard sim profile and
behaves safely"** — finite outputs, no unplanned falls, bounded drift, plus
profile-specific extras (velocity direction/fraction tracking, upright
recovery). It does **not** certify hardware behavior or reproduce an author's
bespoke evaluation protocol; those stay the contributor's responsibility.

## Fidelity

The observation builder, action application (`ctrl = default_pose +
action * scale`), timestep (0.005), decimation (4), and reset pose are ported
from `pollen-robotics/microduck_rl` `scripts/infer_policy.py` and cross-checked
against the official browser simulator (`app/src/game/game.js` and
`constants.js` in the `microduck-simulator` Space). The port was validated by
driving both the upstream reference script and this runtime with the same
policy/scene/command: observations match exactly at reset and trunk trajectories
agree within ~3% over 8 s (float-ordering drift). The registry contract is fixed
at 61 observations (including the unified 13D command) and 14 actions; the
runtime rejects artifacts with other input or output dimensions.
