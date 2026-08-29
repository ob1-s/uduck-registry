#!/usr/bin/env python3
"""Preflight and run every explicitly simulation-verified behavior."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Any


RUNNABLE_STATUSES = frozenset({"verified_simulation"})
SAFE_ID = re.compile(r"^[a-z0-9-]+$")


class RolloutInputError(ValueError):
    pass


def _read_descriptor(path: Path) -> dict[str, Any]:
    try:
        with path.open(encoding="utf-8") as handle:
            value = json.load(handle)
    except (OSError, json.JSONDecodeError) as error:
        raise RolloutInputError(f"cannot read {path}: {error}") from error
    if not isinstance(value, dict):
        raise RolloutInputError(f"{path} must contain a JSON object")
    return value


def discover_rollouts(behaviors_dir: Path, vendor_dir: Path, mjcf_dir: Path, records_dir: Path):
    descriptor_paths = sorted(behaviors_dir.glob("*.json"))
    if not descriptor_paths:
        raise RolloutInputError(f"no behavior descriptors found in {behaviors_dir}")

    candidates: list[tuple[Path, Path, Path, Path]] = []
    errors: list[str] = []
    seen_ids: set[str] = set()
    for descriptor_path in descriptor_paths:
        behavior = _read_descriptor(descriptor_path)
        behavior_id = behavior.get("id")
        status = behavior.get("verification", {}).get("status")
        if not isinstance(behavior_id, str) or not SAFE_ID.fullmatch(behavior_id):
            errors.append(f"{descriptor_path}: invalid safe behavior id {behavior_id!r}")
            continue
        if behavior_id in seen_ids:
            errors.append(f"duplicate behavior id: {behavior_id}")
            continue
        seen_ids.add(behavior_id)

        if status not in RUNNABLE_STATUSES:
            print(f"not selected: {behavior_id} ({status})")
            continue

        mjcf_name = behavior.get("compatibility", {}).get("mjcf_model")
        if not isinstance(mjcf_name, str) or Path(mjcf_name).name != mjcf_name:
            errors.append(f"{behavior_id}: invalid compatibility.mjcf_model {mjcf_name!r}")
            continue

        policy_path = vendor_dir / f"{behavior_id}.onnx"
        mjcf_path = mjcf_dir / mjcf_name
        record_path = records_dir / f"{behavior_id}.json"
        missing = [str(path) for path in (policy_path, mjcf_path) if not path.is_file()]
        if missing:
            errors.append(f"{behavior_id}: missing required input(s): {', '.join(missing)}")
        candidates.append((descriptor_path, policy_path, mjcf_path, record_path))

    if errors:
        raise RolloutInputError("\n".join(errors))
    if not candidates:
        print("No verified_simulation behaviors found; nothing to run.")
    return candidates


def run_rollouts(
    behaviors_dir: Path,
    vendor_dir: Path,
    mjcf_dir: Path,
    records_dir: Path,
    seed: int,
    episode_length: float,
) -> int:
    candidates = discover_rollouts(behaviors_dir, vendor_dir, mjcf_dir, records_dir)
    verifier = Path(__file__).with_name("verify_rollout.py")
    status = 0
    for descriptor, policy, mjcf, record in candidates:
        command = [
            sys.executable,
            str(verifier),
            "--behavior",
            str(descriptor),
            "--policy",
            str(policy),
            "--mjcf",
            str(mjcf),
            "--seed",
            str(seed),
            "--episode-length",
            str(episode_length),
            "--out",
            str(record),
        ]
        print(f"rollout: {descriptor.stem}")
        completed = subprocess.run(command, check=False, shell=False)
        if completed.returncode != 0:
            status = 1
    return status


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--behaviors-dir", type=Path, default=Path("registry/behaviors"))
    parser.add_argument("--vendor-dir", type=Path, default=Path("vendor/policies"))
    parser.add_argument("--mjcf-dir", type=Path, default=Path("sim/mjcf"))
    parser.add_argument("--records-dir", type=Path, default=Path("sim/records"))
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--episode-length", type=float, default=10.0)
    args = parser.parse_args()
    if args.episode_length <= 0:
        raise RolloutInputError("episode length must be positive")
    return run_rollouts(
        args.behaviors_dir,
        args.vendor_dir,
        args.mjcf_dir,
        args.records_dir,
        args.seed,
        args.episode_length,
    )


if __name__ == "__main__":
    try:
        sys.exit(main())
    except (OSError, RolloutInputError, ValueError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        sys.exit(2)
