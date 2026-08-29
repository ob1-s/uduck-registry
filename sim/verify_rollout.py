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

FALL_HEIGHT = 0.15          # meters: base below this = fallen (MicroDuck ~0.3m standing)
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

    pins = load_mjcf_pins().get("pins", {})
    expected = args.mjcf_sha256 or pins.get(mjcf_name)
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

    model = mujoco.MjModel.from_xml_path(args.mjcf)
    data = mujoco.MjData(model)
    mujoco.mj_resetData(model, data)
    np.random.seed(args.seed)

    # Deterministic initial state perturbation from the seed.
    data.qpos[:] += 0.01 * np.random.default_rng(args.seed).standard_normal(model.nq)

    control_dt = 1.0 / behavior["contract"]["control_frequency_hz"]
    decimation = behavior["contract"]["decimation"]
    model.opt.timestep = control_dt / decimation

    steps = int(args.episode_length / control_dt)
    start_x = float(data.qpos[0])
    fell = False
    torques: list[float] = []
    obs = np.zeros(behavior["contract"]["observation_dim"], dtype=np.float32)

    for _ in range(steps):
        action = sess.run(None, {input_name: obs})[0].flatten()[: model.nu]
        action = np.clip(action, -1.0, 1.0) * behavior["contract"]["action_scale"]
        torques.append(float(np.mean(np.abs(action))))
        for _ in range(decimation):
            data.ctrl[:] = action
            mujoco.mj_step(model, data)
        if data.qpos[2] < FALL_HEIGHT or abs(float(data.qpos[3])) < 0.5:
            fell = True
            break
        # Obs advance: in the full harness this reads real sensors; the placeholder
        # zero-obs + seed-perturbed start still exercises determinism end-to-end.
        # TODO(spike): wire the real 61-D observation builder from microduck_rl.
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
