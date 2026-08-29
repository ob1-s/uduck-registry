# MicroDuck 61-D Observation Contract

**Version**: 0.1.0  
**Status**: Solved, source-cited  
**Upstream**: `pollen-robotics/microduck_rl@develop` (resolved commit `d424a0c899f6b33cbd3daeb279913134349c0b63`), `mjlab==1.3.0`  
**Runtime**: `mujoco==3.12.0` (`sha256 7ec16ce408871a0a9157cc556958ab66cd34db9fc1dccd3ef07717170163a4e0`)  
**Contract**: `registry/schema/behavior.ts:108-126` — `observation_dim=61`, `proprioception=48`, `twist=3`, `head_pose=4`, `body_pose=6`; `action_dim=14` (`left_leg=5`, `neck_head=4`, `right_leg=5`); `control_frequency_hz=50`, `decimation=4`, `action_scale=1.0`, `actuator_model="Dynamixel XL330 (BAM M6 actuator physics)"`

This document is the canonical, byte-level specification for the 61-D actor observation consumed by every ONNX policy selected for `verified_simulation`. Any `verified_simulation` rollout (`sim/verify_rollout.py`, `.github/workflows/sim-verify.yml`) must produce exactly this layout, in this order, with these dims.

## Citation Map

All line numbers below are relative to the pinned upstream commit. Local copies are mirrored under `/tmp/mjcf-work/` for offline audit (`mjlab-src/` subset, `microduck_velocity_env_cfg.py`, `mdp.py`).

| Claim | File:line (upstream) | Local mirror |
|-------|----------------------|--------------|
| `VelocityEnvCfg` actor base terms (8 terms) | `mjlab/tasks/velocity/velocity_env_cfg.py:70-108` — dict `actor_terms = {base_lin_vel, base_ang_vel, projected_gravity, joint_pos, joint_vel, actions, command, height_scan}` with `concatenate_terms=True` (`observation_manager.py:ObservationGroupCfg`) | `/tmp/mjcf-work/mjlab-pkg/mjlab-src/mjlab/tasks/velocity/velocity_env_cfg.py:70-108` |
| `base_ang_vel` definition (3 dims) | `mjlab/envs/mdp/observations.py:26-30` `base_ang_vel -> asset.data.root_link_ang_vel_b` (body-frame gyro) | Same path via `microduck-experiments/.venv` |
| `projected_gravity` definition (3 dims) | `mjlab/envs/mdp/observations.py:33-38` `projected_gravity -> asset.data.projected_gravity_b` (`quat_apply_inverse(root_quat, gravity_w)`) | `mjlab/entity/data.py:584-586` |
| `joint_pos_rel` definition | `mjlab/envs/mdp/observations.py:47-55` `joint_pos[:, ids] - default_joint_pos[:, ids]` | — |
| `joint_vel_rel` definition | `mjlab/envs/mdp/observations.py:58-66` `joint_vel[:, ids] - default_joint_vel[:, ids]` | — |
| `last_action` | `mjlab/envs/mdp/observations.py:74-79` `env.action_manager.action` (14 dims) | — |
| `generated_commands` twist | `mjlab/envs/mdp/observations.py:87-91` `command_manager.get_command(command_name)` | — |
| MicroDuck deletes `base_lin_vel` from actor, keeps for critic | `src/mjlab_microduck/robot/microduck_velocity_env_cfg.py:529-536` `del cfg.observations["actor"].terms["base_lin_vel"]` + re-add to critic only | `/tmp/mjcf-work/microduck_velocity_env_cfg.py:529-540` |
| Deletes `height_scan` from both groups (no body terrain sensor) | Same file:532-537 `del ...["height_scan"]` | — |
| Keeps `USE_PROJECTED_GRAVITY=True` -> `projected_gravity` 3, else `raw_accelerometer` | Same file:541-570 conditional | — |
| `base_ang_vel` noise & delay override (actor only) | Same file:560-566 `delay_min_lag=0, delay_max_lag=1, delay_update_period=64, noise Unoise(-0.03,0.03)` | — |
| `projected_gravity` delay/noise override | Same file:568-570 `delay_max_lag=1` | — |
| `joint_vel` 1-step lag | Same file:608-613 `delay_min_lag=1, delay_max_lag=1, delay_update_period=0` | — |
| Filter `passive_*` from joint_obs so dim matches action dim (16->14) | Same file:616-624 `passive_excluded = SceneEntityCfg("robot", joint_names=(r"^(?!passive_).*",))` then `params["asset_cfg"]=passive_excluded` for both groups | — |
| Encoder bias: actor `biased=True`, critic `False` | Same file:627-633 | — |
| Command ranges: `twist` lin_x (-0.4,0.4), lin_y (-0.3,0.3), ang_z (-1.0,1.0) | Same file:648-652 | — |
| Append `head_command` (4D) + `body_command` (6D) to both groups, **order = [twist, head_pose, body_pose]** | Same file:691-701 `for group in ("actor","critic"): cfg.observations[group].terms["head_command"]=...; cfg.observations[group].terms["body_command"]=...` | — |
| `head_pose` ranges per joint (±1.10, ±1.10, ±1.40, ±0.31) | Same file:656-674 | — |
| `body_pose` ranges (6D delta) | Same file:677-689 | — |
| HOME pose definition (14 non-zero defaults) | `src/mjlab_microduck/robot/microduck_constants.py:78-109` `HOME_FRAME` dict | `/tmp/microduck_rl/src/mjlab_microduck/robot/microduck_constants.py:78-109` or local copy at `/tmp/mjcf-work` |
| Action order = XML joint order filtered of `passive_*` | `robot_walk.xml:8-35` + `mdp.py:79-97` exporter patch that filters `passive_`; verified via `mujoco.MjModel: njnt` ordering (see below) | `/tmp/mjcf-work/robot_walk.xml` |

## Deterministic Concatenation Order

`ObservationGroupCfg(concatenate_terms=True)` (`mjlab/managers/observation_manager.py:15-45`) concatenates term tensors in **dict insertion order**. Python 3.7+ preserves insertion order. The final actor dict insertion order after MicroDuck mutations is:

1. `base_ang_vel` (original base order slot 2, but `base_lin_vel` deleted so it becomes first)
2. `projected_gravity` (slot 3)
3. `joint_pos` (slot 4, now filtered to 14)
4. `joint_vel` (slot 5, now filtered + lag 1)
5. `actions` (`last_action`, slot 6)
6. `command` (`twist`, slot 7, after height_scan deleted this stays)
7. `head_command` (appended first)
8. `body_command` (appended second)

No other actor terms survive. Critic has the same plus `base_lin_vel` (privileged, 3 dims), `foot_height`, `foot_air_time`, `foot_contact`, `foot_contact_forces`, `foot_height_scan` etc — but **policy ONNX sees only the 61-D actor vector**.

## 61-D Layout (actor)

| idx | term | dims | dtype | source func | notes |
|-----|------|------|-------|-------------|-------|
| 0–2 | `base_ang_vel` (IMU gyro, body-frame) | 3 | float32 | `mjlab/envs/mdp/observations.py:26` `base_ang_vel` → `asset.data.root_link_ang_vel_b` (`quat_apply_inverse(root_quat, root_ang_vel_w)`) | Delay 0–1 steps (20 ms), noise ±0.03 rad/s (train only). Sim verification uses clean value. |
| 3–5 | `projected_gravity` | 3 | float32 | `projected_gravity` → `asset.data.projected_gravity_b` (`quat_apply_inverse(root_quat, [0,0,-1])`) | `USE_PROJECTED_GRAVITY=True`; if false would be `raw_accelerometer` (same dims, sensor-derived). Delay 0–1, noise ±0.01. |
| 6–19 | `joint_pos_rel` (servo-only) | 14 | float32 | `joint_pos_rel(biased=True)` → `joint_pos_biased[:, servo] - default_joint_pos[:, servo]` | `servo = joint_names matching ^(?!passive_).*` (filters `passive_*wheel`, `passive_*_backlash`, `passive_jaw`). `biased=True` feeds per-env encoder offset to actor only. Sim: unbiased. |
| 20–33 | `joint_vel_rel` (1-step lag) | 14 | float32 | `joint_vel_rel` → `joint_vel[:, servo] - 0` with `delay_min/max_lag=1` | Firmware moving-average; sim verification may use instantaneous but must document lag. |
| 34–47 | `last_action` | 14 | float32 | `last_action` → `env.action_manager.action` (previous ` JointPositionAction` 14-dim, scaled ×1.0) | Init 0. |
| 48–50 | `command` twist (`lin_x, lin_y, ang_z`) | 3 | float32 | `generated_commands(command_name="twist")` | Ranges (-0.4,0.4), (-0.3,0.3), (-1.0,1.0); `rel_standing_envs=0.02`. |
| 51–54 | `head_command` (`neck_pitch, head_pitch, head_yaw, head_roll`) deltas from HOME | 4 | float32 | `generated_commands(command_name="head_pose")` | Ranges initial ±(0.05,0.05,0.07,0.015) → final ±(1.10,1.10,1.40,0.31) via `head_pose_range` curriculum. |
| 55–60 | `body_command` (`x,y,z,roll,pitch,yaw`) deltas from nominal | 6 | float32 | `generated_commands(command_name="body_pose")` | Ranges (-0.005,0.005) xyz + (-0.05,0.05) rpy; weight 0 in vel env (input alive only). |

Total = 3+3+14+14+14+3+4+6 = **61** ✓. Proprioception sub-sum (first 5 rows) = 3+3+14+14+14 = **48** ✓ — matches `contract.observation_breakdown` defaults in `registry/schema/behavior.ts:110-114`.

## Joint / Actuator Order (14)

Canonical order is the XML joint declaration order after filtering `passive_*`. Verified via `mujoco.MjModel` for all 4 variants (nq/nv/nu/njnt listed in `sim/MJCF-MAPPING-REPORT.md`):

```
# robot_walk.xml (njnt=15 includes free joint)
# qposadr 7-20 map to 14 hinges:
 0: left_hip_yaw       (range -0.436 / 0.524)
 1: left_hip_roll      (-0.384 / 0.384)
 2: left_hip_pitch     (-1.571 / 1.571)
 3: left_knee          (-1.571 / 1.571)
 4: left_ankle         (-1.571 / 1.571)
 5: neck_pitch         (-1.571 / 1.047)
 6: head_pitch         (-1.571 / 1.571)
 7: head_yaw           (-2.967 / 2.967)
 8: head_roll          (-0.436 / 0.436)
 9: right_hip_yaw      (-0.524 / 0.436)
10: right_hip_roll     (-0.384 / 0.384)
11: right_hip_pitch    (-1.571 / 1.571)
12: right_knee         (-1.571 / 1.571)
13: right_ankle        (-1.571 / 1.571)
```

Split `contract.action_breakdown` = `left_leg=5` (indices 0-4), `neck_head=4` (5-8), `right_leg=5` (9-13).

**Variants**:
- `robot_allcollisions.xml`: identical 14 order, same qposadr 7-20.
- `robot_allcollisions_rollers.xml`: `njnt=19` includes 4 passive wheels (`passive_LF_wheel` at qposadr 12 etc). Servo qposadr = `[7,8,9,10,11,14,15,16,17,18,19,20,21,22]` (skip 12,13,23,24). Order preserved.
- `robot_walk_backlash.xml`: `njnt=29` includes 14 passive backlash hinges interleaved (every second joint). Servo qposadr = `[7,9,11,13,15,17,19,21,23,25,27,29,31,33]`. Order preserved.

Training `mdp.py:126-132` helper `_servo_joint_ids` (`find_joints(r"^(?!passive_).*")`) is the source of truth; exporter `mdp.py:79-97` filters `passive_*` at export time so ONNX input dim stays 14.

> **SPIKE-PROGRESS typo corrected**: The progress note listed `left_hip_yaw, left_hip_roll, left_hip_pitch, left_knee, left_knee, left_ankle` (duplicate knee, 15 entries). Correct list is above (14, single knee per leg).

## HOME Pose (DEFAULT_QPOS)

No `<keyframe>` in any `robot_*.xml` (`grep keyframe` → 0). HOME is `HOME_FRAME` (`microduck_constants.py:78-109`):

```python
HOME_FRAME = InitialStateCfg(
  joint_pos={
    r".*hip_yaw.*": 0.0,                 # both hips 0
    r".*left_hip_roll.*": -0.0873,       # -5° inward
    r".*right_hip_roll.*": 0.0873,       # +5° inward (sole flat)
    r".*left_hip_pitch.*": -0.4579,      # -26.24°
    r".*right_hip_pitch.*": 0.4579,
    r".*left_knee.*": -0.0049,           # ~-0.28°
    r".*right_knee.*": 0.0049,
    r".*left_ankle.*": 0.4530,           # +25.95°
    r".*right_ankle.*": -0.4530,
    r".*neck_pitch.*": 0.3491,           # +20°
    r".*head_pitch.*": 0.3491,           # +20° (offsets noted in SPIKE-PROGRESS)
    r".*head_yaw.*": 0.0,
    r".*head_roll.*": 0.0,
  })
```

Resolved to XML order above, the 14-dim `DEFAULT_QPOS` (used as `default_joint_pos` in `joint_pos_rel` subtractor) is:

```
[ 0.0, -0.0873, -0.4579, -0.0049, 0.4530, 0.3491, 0.3491, 0.0, 0.0, 0.0, 0.0873, 0.4579, 0.0049, -0.4530 ]
#  l_yaw l_roll  l_pitch l_knee  l_ank   n_pitch h_pitch h_yaw h_roll r_yaw  r_roll  r_pitch r_knee r_ank
```

In `obs_builder.py` this is exported as `DEFAULT_QPOS`. For backlash models, `BACKLASH_HOME_FRAME` (`microduck_constants.py:149-152`) prepends `r".*_backlash$":0.0` (first-match wins) so servo values remain identical and backlash joints are 0.

An earlier `STAND` keyframe notion from `scene.xml` is superseded — training now uses `HOME_FRAME` directly (`MICRODUCK_WALK_ROBOT_CFG = EntityCfg(spec_fn=get_walk_spec, init_state=HOME_FRAME, ...)`). Verified: no XML defines a default; `additional.xml` (611 B) only contains `self_collision_only` and `equality solref`.

## MuJoCo Sensor Mapping (for standalone `obs_builder.py`)

When running without `mjlab` (headless `mujoco.MjModel` + `MjData`), approximate the mjlab derived quantities as:

- `projected_gravity_b ≈ quat_apply_inverse(root_quat_w, [0,0,-1])` where `root_quat_w` is the free joint quat at `qpos[3:7]` (`w,x,y,z` order, MuJoCo stores `w,x,y,z`). Implemented via `mjlab.utils.lab_api.math.quat_apply_inverse` (numpy port in `obs_builder`).
- `base_ang_vel_b ≈ quat_apply_inverse(root_quat_w, root_ang_vel_w)` where `root_ang_vel_w` is the free joint angular velocity (`qvel[3:6]` world frame) — or directly read the gyro sensor `imu_ang_vel` (`sensordata[7:10]`) which should be identical without DR noise. Sim verification reads the gyro sensor if available, else falls back to qvel rotation.
- `joint_pos_rel = qpos[servo_qposadr] - DEFAULT_QPOS`
- `joint_vel_rel = qvel[servo_dofadr] - 0` (with optional 1-step history buffer to emulate lag)
- `last_action` is the previously commanded 14-dim action (clipped to [-1,1] then scaled).
- Commands are caller-provided; standing eval uses `twist=[0,0,0]`, `head=[0,0,0,0]`, `body=[0,0,0,0,0,0]` unless sweeping.

## Verification

- `pnpm validate` checks `contract.observation_dim===61` and `contract.action_dim===14` for every behavior (`scripts/validate-registry.ts:108-115`). Fails closed if mismatched.
- `tests/obs.test.ts` checks that the builder and this contract are present and
  expose the fixed 14-joint HOME pose; the rollout checks the runtime shape and
  dtype before every policy call.
- `sim/verify_rollout.py` now wires `ObsBuilder` (which calls `build_observation`) instead of a zero-filled input; deterministic under fixed seed.
- `sim/mjcf-manifest.json` and `sim/mjcf-pins.json` pin the exact MJCF bytes (`sha256` hex, `size_bytes`) that the builder runs against; any byte change recomputes the `verified_simulation` tier.
