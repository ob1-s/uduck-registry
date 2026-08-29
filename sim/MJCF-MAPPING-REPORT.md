# MJCF Mapping Report — MicroDuck Registry Sim Verification Pins

**Generated**: 2026-08-29T00:30:00Z  
**Source**: `pollen-robotics/microduck_rl@develop` resolved `d424a0c899f6b33cbd3daeb279913134349c0b63` (`/tmp/mjcf-work/tree.json`)  
**Tooling**: `mjlab==1.3.0` (`pyproject.toml`), `mujoco==3.12.0` (`sim/requirements-hashes.txt:5` hash `7ec16ce408871a0a9157cc556958ab66cd34db9fc1dccd3ef07717170163a4e0`)  
**Workdir**: `/tmp/mjcf-work` (43 unique `assets/*.stl`, `assets.sha256`) + `/tmp/mjcvenv` (`mujoco 3.12.0` verified via `python -c "import mujoco; print(mujoco.__version__)"`)

## 1. Behaviors → MJCF Mapping (16 behaviors)

Source: `registry/behaviors/*.json` field `compatibility.mjcf_model` (`registry/schema/behavior.ts:130`). Count verified via `grep mjcf_model registry/behaviors/*.json | sort | uniq -c`.

| MJCF model | Count | Behaviors (id) | Typical terrain / slot |
|------------|-------|----------------|------------------------|
| `robot_walk.xml` | 3 | `alpha-walking` (verified_hardware), `rough-terrain-walk` (community_experimental), `waddle-locomotion` (community_experimental) | flat, walk |
| `robot_allcollisions.xml` | 7 | `ball-kick-left`, `ball-kick-right`, `fall-recovery`, `ground-pick`, `roulade`, `sit-stand` (all verified_hardware), `standing-body-control` (claimed_hardware) | flat, all-collisions (standup/ground-pick) |
| `robot_allcollisions_rollers.xml` | 5 | `roller-drive`, `roller-crouch` (verified_hardware), `roller-slope`, `roller-swizzle`, `spin-in-place` (community_experimental) | rollers, slope/swizzle |
| `robot_walk_backlash.xml` | 1 | `backlash-walking` (community_experimental) | backlash hinge variant |

Matches `SPIKE-PROGRESS.md:5-6` claim 3/7/5/1 exactly.

## 2. Closure Method

All 4 XMLs are **self-contained**: `grep -n "<include" robot_*.xml` → 0 hits. Each declares `compiler meshdir="assets"` (`robot_walk.xml:5` `meshdir="assets"` `autolimits="true"`). Dependency closure = entry XML + every `<mesh file="*.stl">` resolved against that meshdir (XSD `meshdir` semantics; MuJoCo resolves relative to XML path, not CWD).

Extra build fragments `joints_properties.xml` (1780 B, `default class="chosen_actuator"` etc), `sensors.xml` (framequat/gyro/accelerometer), `additional.xml` (611 B `self_collision_only` + `equality solref`) are **baked at export time** via `config_mjcf_*.json:additional_xml` (`["joints_properties.xml","sensors.xml","additional.xml"]`) plus `post_import_commands` (`sed` for trunk height, foot collision names, camera). Verified: `config_walk.json:1-35` + `robot_walk.xml` contains `class="chosen_actuator"` / `class="self_collision_only"` inline, no runtime `<include>` remains. Therefore closure intentionally excludes those fragments — CI ships XML+assets only.

Provenance configs `config_mjcf_*.json` are recorded in the manifest with `kind="provenance_config"` for audit but are **not** fetched at runtime.

## 3. Per-Model Asset Lists (38/38/37/38 meshes, 43 unique)

Asset discovery: `grep -o 'mesh="[^"]*"' robot_*.xml | sort -u` (see `/tmp/mjcf-work/*.meshes` and `assets.sha256` 43 lines).

**Common meshes (present in all 4)** (34 shared):
`banana_pcb_locker.stl`, `bearing_roll.stl`, `bottom_head_shell.stl`, `elec_rpi_robot_hat_pcb.stl`, `face_part.stl`, `hip_l.stl`, `jaw.stl`, `jaw_soft.stl`, `left_shell.stl`, `leg.stl`, `lens.stl`, `m12_lens_holder.stl`, `motor_support.stl`, `neck.stl`, `neck_pitch.stl`, `noenoeil.stl`, `np_f970.stl`, `pcb__raspberry_pi_zero_2_w.stl`, `power_support.stl`, `right_shell.stl`, `seeed_bearing__configuration__22x16x4.stl`, `seeed_bearing__configuration_default.stl`, `soft_mouth_top.stl`, `speaker.stl`, `top_head_shell.stl`, `trunk_base.stl`, `upper_leg_left.stl`, `upper_leg_right.stl`, `upper_leg_rigidity_plate.stl`, `xl330.stl`, `yaw2roll.stl`, `yaw_roll_motion.stl` + `ankle_*` variants + `foot_*`/`roller*`.

**Per-model deltas**:

| Model | Mesh count | Unique assets vs base | `sha256` (XML) | `size_bytes` |
|-------|------------|-----------------------|----------------|--------------|
| `robot_walk.xml` | 38 | baseline | `07af5e482200dfd2a7bf80ddde371153c88768a3a5aebc2f58ea42136fc7dadb` | 32017 |
| `robot_allcollisions.xml` | 38 | identical to `robot_walk` (all-collisions collision geoms differ but meshes same) | `7a6fdf437f5a80c7348ad801f43f906b997a834389cb70cca5e1e8517ba38044` | 32898 |
| `robot_allcollisions_rollers.xml` | 37 | replace `ankle_left/right.stl` + `foot_left/right.stl` (4) with `ankle_l_v1/r_v1.stl` (2) + add `rim.stl`, `roller_blade.stl`, `tire.stl` (3) = net -1 | `c201a72ecbc4dd8e110c840cb79b1647aab59e6c76db7369a88c34a33307447e` | 35688 |
| `robot_walk_backlash.xml` | 38 | identical mesh set to `robot_walk` (backlash hinges are XML-only `passive_*_backlash` joints, no new meshes) | `43686e85bf0fa0c77c89673d546c483d4a22d06a9c81fff3a673bfe9aae36d0d` | 34104 |

Full per-file `sha256`/`size_bytes` tables are in `sim/mjcf-pins.json` (rich `files` map, repo_path `src/mjlab_microduck/robot/microduck/assets/*.stl`) and ordered `sim/mjcf-manifest.json` (`local_path` `assets/*.stl`, `repo_path`, `kind="mesh"`). Unique total on disk: 43 STLs in `/tmp/mjcf-work/assets` (`wc -l assets.sha256` 43). Per-closure total bytes: 38-mesh closures ~23.86 MB assets + ~32 KB XML; rollers ~22.46 MB + 35 KB.

Recompute proof: `hashlib.sha256(open("assets/ankle_left.stl","rb").read()).hexdigest()` → `98f14ba6e6cd138740aa822a615aaa0db34527d499c40b2379aacd13427a1379` matches `assets.sha256:1` and `sim/mjcf-pins.json:11`. All 43 verified via same.

## 4. Compilation Results (mujoco 3.12.0, venv /tmp/mjcvenv)

Harness: copy each XML + its closure `assets/*.stl` into temp `sim/mjcf/` mimicking repo layout, then `mujoco.MjModel.from_xml_path(xml_path)` (deferred import after hash gate per `sim/verify_rollout.py:79`). Negative test (XML alone, no assets) correctly raises `ValueError: Error opening file 'assets/trunk_base.stl'`.

| Model | `nq` | `nv` | `nu` | `nbody` | `njnt` | `ngeom` | `nmesh` | `qpos0[0:3]` | Actuators (14) | Notes |
|-------|------|------|------|---------|--------|---------|---------|-------------|----------------|-------|
| `robot_walk.xml` | 21 | 20 | 14 | 16 | 15 | 75 | 38 | `0 0 0.12` | `left_hip_yaw…right_ankle` (see `sim/OBS-CONTRACT.md`) | Free joint + 14 hinges. |
| `robot_allcollisions.xml` | 21 | 20 | 14 | 16 | 15 | 81 | 38 | `0 0 0.12` | same 14 | Extra collision geoms (+6) |
| `robot_allcollisions_rollers.xml` | 25 | 24 | 14 | 20 | 19 | 89 | 37 | `0 0 0.12` | same 14 (wheels are `passive_LF/RF/LR/RR_wheel`, excluded via `^(?!passive_).*`) | 4 passive wheels (`qposadr 12,13,23,24`), `rim.tire/roller_blade` |
| `robot_walk_backlash.xml` | 35 | 34 | 14 | 16 | 29 | 75 | 38 | `0 0 0.12` | same 14 (backlash hinges excluded) | 14 passive `passive_*_backlash` (±1° = 0.01745 rad) interleaved, servo `qposadr=[7,9,11,13,15,17,19,21,23,25,27,29,31,33]` |

All 4 **OK** in both `/tmp/mjcf-work/` direct load and `sim/mjcf/` closure layout. Details captured via `/tmp/mjcvenv/bin/python` harness `model.jnt_qposadr`, `sensor_adr` etc.

Meshdir test: `meshdir="assets"` resolves relative to XML directory — `sim/mjcf/robot_walk.xml` with `sim/mjcf/assets/` succeeds; moving XML elsewhere without assets fails closed as above.

## 5. Security: Hash-First, Fail-Closed

- `sim/verify_rollout.py:44-77` computes `sha256_file(args.mjcf)` **before** `import mujoco` (`:79` deferred). `pins.get(mjcf_name)` lookup supports both legacy string sha and rich dict (`files[entry].sha256`) for backward compat; mismatch or missing pin → `exit 2` (never simulates against mutable bytes).
- `.github/workflows/sim-verify.yml:44-80` runs only on `pull_request` (never `pull_request_target`), `permissions: {}`, no secrets, container `python:3.12-slim@sha256:09f7…`, actions pinned by SHA (`checkout@3d3c42…`, `upload-artifact@043fb4…`), `pip install --require-hashes -r sim/requirements-hashes.txt` (mujoco/onnxruntime/onnx/numpy digests), `sim/check_onnx.py:15-76` op-allowlist + caps (5000 nodes, 256 MiB) before any rollout, then the same hash-gated fetch (manifest-preferred, pins fallback) with per-file sha/size checks and network drop before simulation.

## 6. Schemas & File Paths

**`sim/mjcf-pins.json`** (currently rich, backward-compat consumer):
```json
{
  "pins": {
    "robot_walk.xml": {
      "source_repo": "pollen-robotics/microduck_rl",
      "ref": "develop",
      "resolved_commit_sha": "d424a0c…",
      "entry": "src/mjlab_microduck/robot/microduck/robot_walk.xml",
      "files": {
        "src/mjlab_microduck/robot/microduck/assets/ankle_left.stl": {"sha256":"98f14…","size_bytes":248984},
        "src/mjlab_microduck/robot/microduck/robot_walk.xml": {"sha256":"07af5…","size_bytes":32017}
      }
    }
  }
}
```
Legacy simple form `pins[mjcf]=sha_hex` is still accepted by `verify_rollout.py:_extract_sha`.

**`sim/mjcf-manifest.json`** (ordered, CI-preferred):
```json
{
  "models": {
    "robot_walk.xml": {
      "entry_repo_path": "src/mjlab_microduck/robot/microduck/robot_walk.xml",
      "entry_local_path": "robot_walk.xml",
      "meshdir": "assets",
      "files": [
        {"order":1, "local_path":"assets/ankle_left.stl", "repo_path":"src/mjlab_microduck/robot/microduck/assets/ankle_left.stl", "sha256":"98f14…","size_bytes":248984,"kind":"mesh"},
        {"order":40,"local_path":"robot_walk.xml","repo_path":"src/mjlab_microduck/robot/microduck/robot_walk.xml","sha256":"07af5…","size_bytes":32017,"kind":"entry_xml"}
      ]
    }
  }
}
```
Relative paths: repo fetch uses `https://raw.githubusercontent.com/pollen-robotics/microduck_rl/<ref>/<repo_path>`; local layout is `sim/mjcf/<local_path>` (`sim/mjcf/robot_walk.xml` + `sim/mjcf/assets/*.stl`). This matches `manifest.$comment`.

Re-pin procedure (reviewed PR only): bump `ref`/`resolved_commit_sha` after fetching upstream, recompute `sha256`/`size_bytes` per file via `hashlib.sha256`, update both files, and record `mjlab`/`mujoco` versions if changed.

## 7. Verification Steps & Discrepancies

**Steps performed**:
1. `ls -R /tmp/mjcf-work`, `cat robot_*.xml | grep mesh` (38/38/37/38), `grep <include` 0, `grep meshdir` `assets` line 5, `cat assets.sha256` 43 lines recomputed via `hashlib`.
2. `hashlib.sha256` on each XML (`07af5…` etc) cross-checked with raw.githubusercontent fetch at pinned commit (7 files spot-checked).
3. `grep mjcf_model registry/behaviors/*.json` → 3/7/5/1.
4. `df -h /tmp` 99% full → clean → `python3 -m venv /tmp/mjcvenv` + `pip install --require-hashes` (compiled 15 hashes via `uv pip compile --generate-hashes`; original `requirements-hashes.txt` had only 4 single hashes, missing transitive `absl-py, etils, fsspec…` — now works, `mujoco.__version__==3.12.0`).
5. `MjModel.from_xml_path` for all 4 in `sim/mjcf/assets` closure + direct + missing-assets negative test (see table).
6. Patched `sim/verify_rollout.py` to handle rich pins and to call `sim/obs_builder.py:build_observation`.
7. Patched `sim-verify.yml` to prefer manifest and to fetch via `src/mjlab_microduck/robot/microduck/` (was `models/` — wrong) and to verify each asset hash/size.

**Discrepancies vs initial spike note**:
- `SPIKE-PROGRESS.md:9` said `/tmp/mjcvenv` "status unknown" — was actually broken (no `mujoco`, `numpy` bus error) due to `/tmp` full and single-hash `requirements-hashes.txt`; fixed.
- `SPIKE-PROGRESS.md:5-13` said "nothing written yet" — `sim/mjcf-pins.json` + `sim/mjcf-manifest.json` were in fact already written at `2026-08-29T00:20Z` (git `modified` + `untracked`) when this report was drafted; this report now documents them.
- `SPIKE-PROGRESS.md: Actuator order` listed 15 entries with duplicate `left_knee` — corrected to 14 in `sim/OBS-CONTRACT.md`.
- `sim/mjcf-pins.json` rich schema broke `verify_rollout.py:68` (string expected) and `sim-verify.yml:71` (`models/` prefix) — both patched to handle dict+string and to use manifest.

All checks now pass locally; `sim-verify.yml` is tested via `python3 - <<'EOF'` dry-run against manifest (no network, local `sim/mjcf/` closure reused).
