# v0.1 Spike Progress — MJCF pins + Obs builder (DONE)

## Status: complete, all spike artifacts written and CI-green.

### Workstream 1 — MJCF dependency closure & pins ✅
- 4 models used by behaviors: `robot_walk.xml` (3), `robot_allcollisions.xml` (7),
  `robot_allcollisions_rollers.xml` (5), `robot_walk_backlash.xml` (1).
- All 4 are self-contained XMLs (no `<include>`), `meshdir="assets"`, reference only
  `.stl` meshes. Closure = XML + its `assets/*.stl` set (38/38/37/38 meshes).
- Downloaded all 43 unique meshes to `/tmp/mjcf-work/assets/` + `assets.sha256` — verified.
- **Done:** per-model sha256 manifest + real MuJoCo compile check (`/tmp/mjcvenv` mujoco 3.12.0
  via hash-pinned install, `MjModel.from_xml_path` OK for all 4 in `sim/mjcf/assets` layout,
  nq/nv/nu/nbody/njnt/ngeom verified), written `sim/mjcf-pins.json` (rich `pins[model].files`
  with `src/mjlab_microduck/robot/microduck/assets/*.stl` sha256/size, backward-compat string
  handling) + `sim/mjcf-manifest.json` (ordered `models[model].files` with `local_path`
  `assets/*.stl` + `robot_*.xml`, `kind=mesh|entry_xml|provenance_config`) +
  `sim/MJCF-MAPPING-REPORT.md` (mapping, closure method, per-model tables, compilation, security).

**Discrepancies fixed**: `/tmp` full breakage repaired, `requirements-hashes.txt` single-hash pitfall
resolved via full hash compile, `sim/mjcf-pins.json` rich vs `verify_rollout.py:68` string expectation
patched to handle both, `sim-verify.yml` `models/` wrong URL → `src/mjlab_microduck/robot/microduck/`,
missing assets fetch → now prefers `sim/mjcf-manifest.json` full closure, ground plane added.

### Workstream 2 — 61-D observation reconstruction ✅ (source-cited, typo fixed)
Source: `pollen-robotics/microduck_rl@develop` (`d424a0c`), mjlab==1.3.0.

Actor obs = mjlab `VelocityEnvCfg` base terms (dict order, concatenated) minus
`base_lin_vel` & `height_scan` (deleted by microduck cfg), plus appended commands:

| idx | term | dims | source |
|-----|------|------|--------|
| 0–2 | base_ang_vel (imu) | 3 | mjlab velocity_env_cfg.py:82 |
| 3–5 | projected_gravity | 3 | idem:87 (USE_PROJECTED_GRAVITY=True) |
| 6–19 | joint_pos_rel (servo, excl passive) | 14 | idem:91 |
| 20–33 | joint_vel_rel (1-step lag) | 14 | idem:95 |
| 34–47 | last_action | 14 | idem:99 |
| 48–50 | command twist (lin_x, lin_y, ang_z) | 3 | idem:100 |
| 51–54 | head_command (neck_pitch, head_pitch, head_yaw, head_roll) | 4 | microduck_velocity_env_cfg.py:692 |
| 55–60 | body_command (x,y,z,roll,pitch,yaw) | 6 | idem:692 |

Total 61 ✓. Proprio = 3+3+14+14+14 = 48 ✓. **Contract matches code exactly — no discrepancies.**

Actuator/joint order (14, from robot_walk.xml, = contract 5+4+5) — **typo fixed** (was duplicate `left_knee`):
`left_hip_yaw, left_hip_roll, left_hip_pitch, left_knee, left_ankle, neck_pitch, head_pitch, head_yaw, head_roll, right_hip_yaw, right_hip_roll, right_hip_pitch, right_knee, right_ankle`
(order verified via `mujoco.MjModel` njnt/qposadr for walk/rollers/backlash, `mdp.py:_servo_joint_ids`).

HOME pose: NOT in XML (no keyframe). Resolved via `microduck_constants.py:78-109` `HOME_FRAME`
(`left_hip_roll -0.0873`, `right_hip_roll 0.0873`, `left_hip_pitch -0.4579`, `right_hip_pitch 0.4579`,
`left_knee -0.0049`, `right_knee 0.0049`, `left_ankle 0.4530`, `right_ankle -0.4530`,
`neck_pitch 0.3491`, `head_pitch 0.3491`, head yaw/roll 0). Full `DEFAULT_QPOS` 14-dim in `sim/obs_builder.py`
matches `default_joint_pos` metadata in vendored ONNX (`joint_names` order).

**Done:** `sim/OBS-CONTRACT.md` (layout, joint order, HOME, citations) + `sim/obs_builder.py`
(`build_observation(model,data,command)->(61,)float32`, `ACTION_JOINT_NAMES`, `DEFAULT_QPOS`,
`ObsBuilder` with 1-step lag, batched ONNX support, servo discovery).

## Next steps — COMPLETED
1. ✅ Finish MJCF: per-model sha256 manifest, real compile, `sim/mjcf-pins.json` + `sim/mjcf-manifest.json` + `sim/MJCF-MAPPING-REPORT.md`
2. ✅ Write `sim/OBS-CONTRACT.md` + `sim/obs_builder.py` (HOME qpos resolved)
3. ✅ Wire `obs_builder.py` into `sim/verify_rollout.py` (HOME init, ground plane via MjSpec, batched obs, rich pin handling), update `sim-verify.yml` to fetch full closure per manifest
4. ✅ Add tests (`tests/obs.test.ts` 6 checks), run `pnpm validate && pnpm test && pnpm build` (16/16 validate, 16/16 tests, build OK, `sim/check_onnx.py` OK with Elu + metadata allowlist), commit

## Key facts / pins
- mjlab==1.3.0 (pinned in microduck_rl pyproject). mujoco==3.12.0
  (sha256 7ec16ce408871a0a9157cc556958ab66cd34db9fc1dccd3ef07717170163a4e0).
- Upstream repo: pollen-robotics/microduck_rl, branch develop,
  prefix src/mjlab_microduck/robot/microduck/, resolved `d424a0c899f6b33cbd3daeb279913134349c0b63`
- Working dir (ephemeral): /tmp/mjcf-work (meshes, mjlab-src, venv /tmp/mjcvenv → 3.12.0 OK)
- Artifacts: `sim/obs_builder.py:14` joints, `sim/verify_rollout.py:8` FALL_HEIGHT 0.08 (HOME 0.10), travel 0.34m/5s with ground plane now realistic
