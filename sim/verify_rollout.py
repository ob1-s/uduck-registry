#!/usr/bin/env python3
"""
Deterministic headless MuJoCo rollout of a vendored ONNX policy.

Grading (fixed seed, pinned MuJoCo + MJCF hash):
  - travel:   forward distance covered over the episode
  - fall:     did the base drop below the fall threshold / tip over
  - stability: mean |torque| and base-height variance

Outputs a JSON verification record shaped for registry/behaviors/*.json
`sim_verification`. The caller (CI) writes it back with the workflow URL.

Usage:
  python3 verify_rollout.py --behavior registry/behaviors/alpha-walking.json \
      --mjcf sim/mjcf/robot_walk.xml --policy vendor/policies/alpha-walking.onnx \
      --seed 0 --episode-length 10.0 --out sim/records/alpha-walking.json

The MJCF must hash-match the pinned value in sim/mjcf-pins.json (or the value
passed via --mjcf-sha256 for a fresh pin). A mutable upstream MJCF is never
trusted — hash first, simulate second.
"""
import argparse
import hashlib
import json
import os
import sys
import datetime

import numpy as np

FALL_HEIGHT = 0.08          # meters: base below this = fallen (MicroDuck trunk ~0.10m standing at HOME on plane; 0.08 is clear fall, 0.15 would be above HOME)
TRAVEL_PASS_M = 0.5         # meters forward required to grade "pass"
STABILITY_PASS = 0.05       # normalized torque-smoothness threshold


def sha256_file(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def load_mjcf_pins() -> dict:
    pins_path = os.path.join(os.path.dirname(__file__), "mjcf-pins.json")
    if os.path.exists(pins_path):
        with open(pins_path) as f:
            return json.load(f)
    return {}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--behavior", required=True, help="behavior JSON (for mjcf_model + metadata)")
    ap.add_argument("--policy", required=True, help="vendored ONNX policy")
    ap.add_argument("--mjcf", required=True, help="pinned MJCF file")
    ap.add_argument("--seed", type=int, default=0)
    ap.add_argument("--episode-length", type=float, default=10.0)
    ap.add_argument("--mjcf-sha256", default=None, help="override pin (fresh pin workflow)")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    with open(args.behavior) as f:
        behavior = json.load(f)
    mjcf_name = behavior["compatibility"]["mjcf_model"]

    pins_raw = load_mjcf_pins().get("pins", {})
    # Support both string pins (legacy) and rich dict pins (entry.files[entry].sha256)
    def _extract_sha(v):
        if isinstance(v, str):
            return v
        if isinstance(v, dict):
            # rich form: {entry: "path", files: {path: {sha256,...}}}
            entry = v.get("entry")
            files = v.get("files", {})
            if entry and entry in files and isinstance(files[entry], dict):
                return files[entry].get("sha256")
            # fallback: direct sha256 field
            if "sha256" in v:
                return v["sha256"]
        return None

    expected_raw = args.mjcf_sha256 or pins_raw.get(mjcf_name)
    expected = _extract_sha(expected_raw) if expected_raw is not None else None
    actual = sha256_file(args.mjcf)
    if not expected:
        print(f"No MJCF pin for '{mjcf_name}' in sim/mjcf-pins.json. "
              f"Add the official MJCF's hash before simulating. Actual hash: {actual}")
        return 2
    if actual != expected:
        print(f"MJCF hash mismatch for {mjcf_name}: pinned {expected}, got {actual}. "
              "A mutable MJCF is never trusted — re-pin deliberately if upstream changed.")
        return 2

    import mujoco  # deferred: only import after the hash gate passes
    import onnxruntime as ort

    print(f"MuJoCo {mujoco.__version__}, seed {args.seed}, MJCF sha256 {actual[:12]}…")

    sess = ort.InferenceSession(args.policy, providers=["CPUExecutionProvider"])
    input_name = sess.get_inputs()[0].name

    # Load MJCF via MjSpec so we can guarantee a ground plane (training uses TerrainEntity plane;
    # the bare robot XML has no ground and would fall through without it).
    try:
        spec = mujoco.MjSpec.from_file(args.mjcf)
        # Add ground plane if not already present (check for plane geom)
        has_plane = any(g.type == mujoco.mjtGeom.mjGEOM_PLANE for g in spec.worldbody.geoms)
        if not has_plane:
            g = spec.worldbody.add_geom()
            g.type = mujoco.mjtGeom.mjGEOM_PLANE
            # For mjGEOM_PLANE size is (x, y, z) grid, 0 0 0.1 means infinite plane; [10,10,0.1] would be finite and not cover correctly
            g.size = [0, 0, 0.1]
            g.pos = [0, 0, 0]
            g.rgba = [0.85, 0.85, 0.85, 1.0]
            g.contype = 1
            g.conaffinity = 1
        model = spec.compile()
    except Exception as e:
        print(f"MjSpec compile with ground failed ({e}), falling back to MjModel.from_xml_path")
        model = mujoco.MjModel.from_xml_path(args.mjcf)
    data = mujoco.MjData(model)
    mujoco.mj_resetData(model, data)
    np.random.seed(args.seed)

    # Initialize to HOME pose (microduck_constants.py:78-109) + deterministic perturbation.
    # The training env resets via HOME_FRAME; zero qpos is unstable (hip/ankle at 0, not HOME).
    try:
        import pathlib as _pathlib2
        _repo_root2 = _pathlib2.Path(__file__).resolve().parent.parent
        if str(_repo_root2) not in sys.path:
            sys.path.insert(0, str(_repo_root2))
        from sim.obs_builder import DEFAULT_QPOS, _servo_joint_info  # type: ignore

        qpos_addrs, _, servo_names = _servo_joint_info(model)
        # Map DEFAULT_QPOS (canonical order) to discovered qpos_addrs order
        if servo_names == DEFAULT_QPOS.size * [""]:
            pass
        # Build name->val for canonical
        from sim.obs_builder import ACTION_JOINT_NAMES  # type: ignore

        rng = np.random.default_rng(args.seed)
        # Perturb only servo joints slightly; keep free joint (first 7) with small pos noise + quat
        name_to_val = {n: float(v) for n, v in zip(ACTION_JOINT_NAMES, DEFAULT_QPOS)}
        for name, addr in zip(servo_names, qpos_addrs):
            base = name_to_val.get(name, 0.0)
            noise = 0.01 * float(rng.standard_normal())
            data.qpos[addr] = base + noise
        # Free joint: start slightly above ground to avoid initial penetration
        # Training `reset_base` uses z in (0.01,0.05) offset on top of terrain; for headless
        # MuJoCo (no terrain) we start at 0.25 so the robot can settle without triggering
        # FALL_HEIGHT=0.15 immediate fall (HOME z at 0.12 would be <0.15 and fail at step 0).
        data.qpos[0] = 0.01 * float(rng.standard_normal())  # x
        data.qpos[1] = 0.01 * float(rng.standard_normal())  # y
        data.qpos[2] = 0.25  # trunk height
        # Quat: small yaw perturbation, keep normalized near [1,0,0,0]
        yaw_noise = 0.05 * float(rng.standard_normal())
        half = yaw_noise * 0.5
        data.qpos[3] = np.cos(half)
        data.qpos[4] = 0.0
        data.qpos[5] = 0.0
        data.qpos[6] = np.sin(half)
        # Ensure joint vel start at 0
        data.qvel[:] = 0.01 * rng.standard_normal(model.nv) * 0.1  # small vel noise
        # Normalize quat
        quat = data.qpos[3:7].copy()
        n = np.linalg.norm(quat)
        if n > 1e-8:
            data.qpos[3:7] = quat / n
        mujoco.mj_forward(model, data)
    except Exception as e:
        # Fallback: small universal perturbation (old path)
        print(f"HOME init failed ({e}), using generic perturb")
        data.qpos[:] += 0.01 * np.random.default_rng(args.seed).standard_normal(model.nq)

    control_dt = 1.0 / behavior["contract"]["control_frequency_hz"]
    decimation = behavior["contract"]["decimation"]
    model.opt.timestep = control_dt / decimation

    steps = int(args.episode_length / control_dt)
    start_x = float(data.qpos[0])
    fell = False
    torques: list[float] = []

    # Real 61-D observation builder (sim/obs_builder.py). Falls back to zero if import fails.
    try:
        # Ensure repo root is on sys.path when run as `python sim/verify_rollout.py`
        import pathlib as _pathlib
        _repo_root = _pathlib.Path(__file__).resolve().parent.parent
        if str(_repo_root) not in sys.path:
            sys.path.insert(0, str(_repo_root))
        from sim.obs_builder import ObsBuilder  # type: ignore
        obs_builder = ObsBuilder(model)
        # Seed-perturbed HOME is already in qpos; initialize builder history to match.
        # Deterministic command: forward 0.4 m/s (covers TRAVEL_PASS_M=0.5 in 10s) + zero head/body.
        # This matches microduck velocity cfg ranges lin_x (-0.4,0.4) and exercises locomotion.
        command = {"twist": np.array([0.4, 0.0, 0.0], dtype=np.float32),
                   "head": np.zeros(4, dtype=np.float32),
                   "body": np.zeros(6, dtype=np.float32)}
        obs = obs_builder.step(data, command=command)
        use_builder = True
    except Exception as e:
        print(f"obs_builder unavailable ({e}), falling back to zero obs")
        obs = np.zeros(behavior["contract"]["observation_dim"], dtype=np.float32)
        obs_builder = None
        use_builder = False
        command = None

    for _ in range(steps):
        # ONNX expects batched [1,61] (see vendor/policies/*.onnx input shape)
        obs_batched = obs[None, :].astype(np.float32) if obs.ndim == 1 else obs
        action = sess.run(None, {input_name: obs_batched})[0].reshape(-1)[: model.nu]
        action = np.clip(action, -1.0, 1.0) * behavior["contract"]["action_scale"]
        torques.append(float(np.mean(np.abs(action))))
        for _ in range(decimation):
            data.ctrl[:] = action
            mujoco.mj_step(model, data)
        if data.qpos[2] < FALL_HEIGHT or abs(float(data.qpos[3])) < 0.5:
            fell = True
            break
        if use_builder:
            # Advance observation via builder (uses updated data.qpos/qvel/sensordata)
            # Update builder's last_action so next obs sees the action history.
            obs_builder.update_last_action(action)
            obs = obs_builder.step(data, command=command)
        else:
            obs[:] = 0.0

    travel = float(data.qpos[0]) - start_x
    torque_smooth = float(np.mean(torques)) if torques else 1.0
    stability = 1.0 - min(1.0, torque_smooth)
    grade = "pass" if (not fell and travel >= TRAVEL_PASS_M and stability >= STABILITY_PASS) else "fail"

    record = {
        "mujoco_version": mujoco.__version__,
        "mjcf_sha256": actual,
        "seed": args.seed,
        "episode_length_s": args.episode_length,
        "grade": grade,
        "travel_score": round(travel, 4),
        "stability_score": round(stability, 4),
        "fell": fell,
        "verified_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(record, f, indent=2)
        f.write("\n")
    print(json.dumps(record, indent=2))
    return 0 if grade == "pass" else 1


if __name__ == "__main__":
    sys.exit(main())
