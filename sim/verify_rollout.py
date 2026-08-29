#!/usr/bin/env python3
"""Run a deterministic, task-aware MuJoCo rollout for one vendored policy.

The policy and MJCF are both hash-gated before MuJoCo or ONNX Runtime is
loaded. A rollout record contains enough byte/source information to reproduce
the result; failures are returned to the caller instead of being replaced by
zero observations or a generic model fallback.

Usage:
  python3 sim/verify_rollout.py --behavior registry/behaviors/alpha-walking.json \
      --mjcf sim/mjcf/robot_walk.xml --policy vendor/policies/alpha-walking.onnx \
      --seed 0 --episode-length 10.0 --out sim/records/alpha-walking.json
"""

from __future__ import annotations

import argparse
import datetime
import hashlib
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np

try:
    from .check_onnx import check as check_onnx
except ImportError:  # python sim/verify_rollout.py
    from check_onnx import check as check_onnx


OBS_DIM = 61
ACTION_DIM = 14
CONTROL_FREQUENCY_HZ = 50
DECIMATION = 4
FALL_HEIGHT = 0.08
TRAVEL_PASS_M = 0.5
STABILITY_PASS = 0.05
COMMIT_SHA_RE = re.compile(r"^[0-9a-f]{40}$")


@dataclass(frozen=True)
class TaskProfile:
    name: str
    command: dict[str, tuple[float, ...]]
    minimum_travel_m: float | None
    require_no_fall: bool = True


def _command(
    twist: tuple[float, float, float] = (0.0, 0.0, 0.0),
    head: tuple[float, float, float, float] = (0.0, 0.0, 0.0, 0.0),
    body: tuple[float, float, float, float, float, float] = (0.0, 0.0, 0.0, 0.0, 0.0, 0.0),
) -> dict[str, tuple[float, ...]]:
    return {"twist": twist, "head": head, "body": body}


WALK_COMMAND = _command(twist=(0.4, 0.0, 0.0))

# These are the tasks this standalone verifier can grade meaningfully. It has
# the flat robot models and a travel/no-fall criterion; object, slope, pose,
# and acrobatic tasks need their task scenes and success metrics first.
TASK_PROFILES: dict[str, TaskProfile] = {
    "Mjlab-Velocity-Flat-MicroDuck": TaskProfile("velocity-flat", WALK_COMMAND, TRAVEL_PASS_M),
    "Mjlab-Velocity-Flat-Backlash-MicroDuck": TaskProfile("velocity-backlash", WALK_COMMAND, TRAVEL_PASS_M),
    "Mjlab-Velocity-Flat-MicroDuck-Rollers": TaskProfile("roller-velocity", WALK_COMMAND, TRAVEL_PASS_M),
}


class RolloutError(RuntimeError):
    """An input or runtime condition that must fail the simulation tier."""


def select_task_profile(behavior: dict[str, Any]) -> tuple[str, TaskProfile]:
    task_id = behavior.get("sources", {}).get("task_id")
    if not isinstance(task_id, str) or task_id not in TASK_PROFILES:
        raise RolloutError(
            f"no supported rollout profile for task_id {task_id!r}; "
            "the standalone verifier currently grades flat velocity tasks only"
        )
    return task_id, TASK_PROFILES[task_id]


def sha256_file(path: str | Path) -> str:
    digest = hashlib.sha256()
    with Path(path).open("rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _load_json(path: str | Path) -> dict[str, Any]:
    with Path(path).open(encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict):
        raise RolloutError(f"{path} must contain a JSON object")
    return value


def load_mjcf_pin(mjcf_name: str) -> dict[str, Any]:
    pins_path = Path(__file__).with_name("mjcf-pins.json")
    pins = _load_json(pins_path).get("pins", {})
    pin = pins.get(mjcf_name)
    if not isinstance(pin, dict):
        raise RolloutError(f"no rich MJCF pin for {mjcf_name!r}")

    entry = pin.get("entry")
    files = pin.get("files")
    entry_pin = files.get(entry) if isinstance(files, dict) and isinstance(entry, str) else None
    expected_sha = entry_pin.get("sha256") if isinstance(entry_pin, dict) else None
    source_repo = pin.get("source_repo")
    resolved_commit = pin.get("resolved_commit_sha")
    if not isinstance(expected_sha, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_sha):
        raise RolloutError(f"MJCF pin for {mjcf_name!r} has no valid entry SHA-256")
    if not isinstance(entry, str) or not entry:
        raise RolloutError(f"MJCF pin for {mjcf_name!r} has no entry path")
    if not isinstance(source_repo, str) or not source_repo:
        raise RolloutError(f"MJCF pin for {mjcf_name!r} has no source repository")
    if not isinstance(resolved_commit, str) or not COMMIT_SHA_RE.fullmatch(resolved_commit):
        raise RolloutError(
            f"MJCF pin for {mjcf_name!r} must contain a 40-character resolved commit SHA"
        )
    return {
        "sha256": expected_sha,
        "source_repo": source_repo,
        "resolved_commit_sha": resolved_commit,
        "entry": entry,
    }


def verify_policy(policy_path: str | Path, behavior: dict[str, Any]) -> tuple[str, int]:
    policy = Path(policy_path)
    if not policy.is_file():
        raise RolloutError(f"missing policy bytes: {policy}")

    artifact = behavior.get("artifacts", {}).get("onnx", {})
    expected_sha = artifact.get("sha256")
    expected_size = artifact.get("size_bytes")
    if not isinstance(expected_sha, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_sha):
        raise RolloutError("selected policy has no valid artifact SHA-256")
    if not isinstance(expected_size, int) or expected_size < 0:
        raise RolloutError("selected policy has no valid artifact size")

    actual_size = policy.stat().st_size
    actual_sha = sha256_file(policy)
    if actual_size != expected_size:
        raise RolloutError(
            f"policy size mismatch: expected {expected_size}, got {actual_size}"
        )
    if actual_sha != expected_sha:
        raise RolloutError(
            f"policy SHA-256 mismatch: expected {expected_sha}, got {actual_sha}"
        )

    static_errors = check_onnx(str(policy))
    if static_errors:
        raise RolloutError("ONNX static contract failed: " + "; ".join(static_errors))
    return actual_sha, actual_size


def validate_contract(behavior: dict[str, Any]) -> dict[str, Any]:
    contract = behavior.get("contract")
    if not isinstance(contract, dict):
        raise RolloutError("behavior has no contract object")
    if contract.get("observation_dim") != OBS_DIM:
        raise RolloutError(f"simulation requires observation_dim={OBS_DIM}")
    if contract.get("action_dim") != ACTION_DIM:
        raise RolloutError(f"simulation requires action_dim={ACTION_DIM}")
    if contract.get("control_frequency_hz") != CONTROL_FREQUENCY_HZ:
        raise RolloutError(f"simulation requires control_frequency_hz={CONTROL_FREQUENCY_HZ}")
    if contract.get("decimation") != DECIMATION:
        raise RolloutError(f"simulation requires decimation={DECIMATION}")
    return contract


def _compile_model(mujoco: Any, mjcf_path: Path) -> Any:
    # MjSpec lets the standalone XMLs run with the same infinite plane used by
    # the training environment. Compilation errors are fatal; the raw XML
    # fallback previously hid malformed or incomplete assets.
    spec = mujoco.MjSpec.from_file(str(mjcf_path))
    has_plane = any(
        geom.type == mujoco.mjtGeom.mjGEOM_PLANE for geom in spec.worldbody.geoms
    )
    if not has_plane:
        geom = spec.worldbody.add_geom()
        geom.type = mujoco.mjtGeom.mjGEOM_PLANE
        geom.size = [0, 0, 0.1]
        geom.pos = [0, 0, 0]
        geom.rgba = [0.85, 0.85, 0.85, 1.0]
        geom.contype = 1
        geom.conaffinity = 1
    return spec.compile()


def _initialize_home(mujoco: Any, model: Any, data: Any, seed: int) -> None:
    if model.nq < 7 or model.nv < 6:
        raise RolloutError("MJCF must expose a free base joint")

    repo_root = Path(__file__).resolve().parent.parent
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))
    from sim.obs_builder import ACTION_JOINT_NAMES, DEFAULT_QPOS, _servo_joint_info

    qpos_addrs, _, servo_names = _servo_joint_info(model)
    if servo_names != ACTION_JOINT_NAMES:
        raise RolloutError("MJCF servo order does not match the 14-D policy contract")

    rng = np.random.default_rng(seed)
    name_to_value = {name: float(value) for name, value in zip(ACTION_JOINT_NAMES, DEFAULT_QPOS)}
    for name, address in zip(servo_names, qpos_addrs):
        data.qpos[address] = name_to_value[name] + 0.01 * float(rng.standard_normal())

    data.qpos[0] = 0.01 * float(rng.standard_normal())
    data.qpos[1] = 0.01 * float(rng.standard_normal())
    data.qpos[2] = float(model.qpos0[2])
    yaw_noise = 0.05 * float(rng.standard_normal())
    half = yaw_noise * 0.5
    data.qpos[3:7] = [np.cos(half), 0.0, 0.0, np.sin(half)]
    data.qvel[:] = 0.001 * rng.standard_normal(model.nv)
    quat = data.qpos[3:7]
    data.qpos[3:7] = quat / np.linalg.norm(quat)
    mujoco.mj_forward(model, data)


def _github_provenance() -> dict[str, str]:
    values = {
        "repository": os.environ.get("GITHUB_REPOSITORY", ""),
        "commit": os.environ.get("GITHUB_SHA", ""),
        "workflow": os.environ.get("GITHUB_WORKFLOW", ""),
        "run_id": os.environ.get("GITHUB_RUN_ID", ""),
    }
    server = os.environ.get("GITHUB_SERVER_URL", "https://github.com")
    if values["repository"] and values["run_id"]:
        values["run_url"] = f"{server}/{values['repository']}/actions/runs/{values['run_id']}"
    return {key: value for key, value in values.items() if value}


def _write_record(path: Path, record: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(record, handle, indent=2)
        handle.write("\n")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--behavior", required=True, help="behavior descriptor JSON")
    parser.add_argument("--policy", required=True, help="vendored ONNX policy")
    parser.add_argument("--mjcf", required=True, help="hash-pinned MJCF entry XML")
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--episode-length", type=float, default=10.0)
    parser.add_argument("--out", required=True, help="verification record JSON")
    args = parser.parse_args()

    if args.episode_length <= 0:
        raise RolloutError("episode length must be positive")

    behavior = _load_json(args.behavior)
    if behavior.get("verification", {}).get("status") != "verified_simulation":
        raise RolloutError("rollouts are only allowed for verified_simulation entries")
    contract = validate_contract(behavior)
    task_id, profile = select_task_profile(behavior)
    mjcf_name = behavior.get("compatibility", {}).get("mjcf_model")
    if not isinstance(mjcf_name, str) or not mjcf_name:
        raise RolloutError("behavior has no compatibility.mjcf_model")

    policy_sha, policy_size = verify_policy(args.policy, behavior)
    pin = load_mjcf_pin(mjcf_name)
    expected_mjcf_sha = pin["sha256"]
    if not isinstance(expected_mjcf_sha, str) or not re.fullmatch(r"[0-9a-f]{64}", expected_mjcf_sha):
        raise RolloutError("MJCF SHA-256 must be 64 lowercase hexadecimal characters")
    mjcf_path = Path(args.mjcf)
    if not mjcf_path.is_file():
        raise RolloutError(f"missing MJCF bytes: {mjcf_path}")
    actual_mjcf_sha = sha256_file(mjcf_path)
    if actual_mjcf_sha != expected_mjcf_sha:
        raise RolloutError(
            f"MJCF hash mismatch: expected {expected_mjcf_sha}, got {actual_mjcf_sha}"
        )

    import mujoco
    import onnxruntime as ort

    model = _compile_model(mujoco, mjcf_path)
    if model.nu != ACTION_DIM:
        raise RolloutError(f"MJCF exposes {model.nu} actuators; expected {ACTION_DIM}")
    data = mujoco.MjData(model)
    mujoco.mj_resetData(model, data)
    _initialize_home(mujoco, model, data, args.seed)

    control_dt = 1.0 / float(contract["control_frequency_hz"])
    decimation = int(contract["decimation"])
    model.opt.timestep = control_dt / decimation
    steps = int(args.episode_length / control_dt)

    session = ort.InferenceSession(str(args.policy), providers=["CPUExecutionProvider"])
    inputs = session.get_inputs()
    if len(inputs) != 1 or inputs[0].shape != [1, OBS_DIM] or inputs[0].type != "tensor(float)":
        raise RolloutError(
            f"ONNX Runtime input must be tensor(float)[1,{OBS_DIM}], got "
            f"{[(item.shape, item.type) for item in inputs]}"
        )
    input_name = inputs[0].name

    outputs = session.get_outputs()
    if len(outputs) != 1 or outputs[0].shape != [1, ACTION_DIM] or outputs[0].type != "tensor(float)":
        raise RolloutError(
            f"ONNX Runtime output must be tensor(float)[1,{ACTION_DIM}], got "
            f"{[(item.shape, item.type) for item in outputs]}"
        )

    from sim.obs_builder import DEFAULT_QPOS, ObsBuilder

    obs_builder = ObsBuilder(model)
    command = profile.command
    obs = obs_builder.step(data, command=command)
    start_x = float(data.qpos[0])
    action_magnitudes: list[float] = []
    heights: list[float] = [float(data.qpos[2])]
    upright_samples: list[float] = [
        float(data.qpos[2] >= FALL_HEIGHT and abs(float(data.qpos[3])) >= 0.5)
    ]
    fell = False
    terminated_on_fall = False

    for _ in range(steps):
        if obs.shape != (OBS_DIM,) or obs.dtype != np.float32 or not np.all(np.isfinite(obs)):
            raise RolloutError("observation builder emitted invalid 61-D float32 data")
        output_values = session.run(None, {input_name: obs[None, :]})
        if len(output_values) != 1:
            raise RolloutError(f"ONNX Runtime returned {len(output_values)} outputs")
        raw_action = np.asarray(output_values[0])
        if raw_action.shape != (1, ACTION_DIM) or raw_action.dtype != np.float32:
            raise RolloutError(
                f"ONNX Runtime returned {raw_action.shape}/{raw_action.dtype}; "
                f"expected (1, {ACTION_DIM})/float32"
            )
        if not np.all(np.isfinite(raw_action)):
            raise RolloutError("policy returned non-finite action values")

        policy_action = np.clip(raw_action[0], -1.0, 1.0)
        action_scale = float(contract.get("action_scale", 1.0))
        target_action = DEFAULT_QPOS + action_scale * policy_action
        action_magnitudes.append(float(np.mean(np.abs(policy_action))))
        for _ in range(decimation):
            data.ctrl[:] = target_action
            mujoco.mj_step(model, data)
        heights.append(float(data.qpos[2]))
        if not np.all(np.isfinite(data.qpos)) or not np.all(np.isfinite(data.qvel)):
            raise RolloutError("MuJoCo state became non-finite")

        upright_samples.append(
            float(data.qpos[2] >= FALL_HEIGHT and abs(float(data.qpos[3])) >= 0.5)
        )
        if data.qpos[2] < FALL_HEIGHT or abs(float(data.qpos[3])) < 0.5:
            fell = True
            terminated_on_fall = True
            break
        obs_builder.update_last_action(policy_action)
        obs = obs_builder.step(data, command=command)

    travel = float(data.qpos[0]) - start_x
    mean_abs_action = float(np.mean(action_magnitudes)) if action_magnitudes else 1.0
    stability = float(np.mean(upright_samples)) if upright_samples else 0.0
    criteria = {
        "no_fall": (not fell) if profile.require_no_fall else True,
        "minimum_travel": (
            True if profile.minimum_travel_m is None else travel >= profile.minimum_travel_m
        ),
        "stability": stability >= STABILITY_PASS,
    }
    grade = "pass" if all(criteria.values()) else "fail"

    record: dict[str, Any] = {
        "format_version": 1,
        "behavior_id": behavior.get("id"),
        "task_id": task_id,
        "rollout_profile": profile.name,
        "rollout_profile_version": "v1",
        "mujoco_version": mujoco.__version__,
        "mjcf_model": mjcf_name,
        "mjcf_sha256": actual_mjcf_sha,
        "mjcf_source_repo": pin["source_repo"],
        "mjcf_source_commit": pin["resolved_commit_sha"],
        "mjcf_entry": pin["entry"],
        "policy_sha256": policy_sha,
        "policy_size_bytes": policy_size,
        "policy_filename": behavior.get("artifacts", {}).get("onnx", {}).get("filename"),
        "policy_url": behavior.get("artifacts", {}).get("onnx", {}).get("url"),
        "seed": args.seed,
        "episode_length_s": args.episode_length,
        "steps_requested": steps,
        "steps_completed": len(action_magnitudes),
        "command": {key: list(value) for key, value in command.items()},
        "criteria": criteria,
        "grade": grade,
        "travel_score": round(travel, 4),
        "stability_score": round(stability, 4),
        "mean_abs_action": round(mean_abs_action, 4),
        "base_height_min": round(float(np.min(heights)), 4),
        "base_height_max": round(float(np.max(heights)), 4),
        "fell": fell,
        "terminated_on_fall": terminated_on_fall,
        "provenance": _github_provenance(),
        "verified_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    _write_record(Path(args.out), record)
    print(json.dumps(record, indent=2))
    return 0 if grade == "pass" else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, KeyError, TypeError, ValueError, RolloutError, ImportError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(2)
