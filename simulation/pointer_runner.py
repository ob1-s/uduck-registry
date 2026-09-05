"""Adapt a resolved Pollen pointer to the registry simulation contract.

This module contains no network access and never executes publisher code.  The
resolver/build step supplies the pinned pointer and manifest; a reviewed recipe
from :mod:`pointer_recipes` supplies the command schedule.  Keeping this
adapter separate makes it usable by the evidence job and keeps authored pointer
files free of runtime defaults.
"""

from __future__ import annotations

from hashlib import sha256
from typing import Any

try:  # Imported as ``simulation.pointer_runner`` or as a PYTHONPATH script.
    from .pointer_recipes import recipe_for_policy
except ImportError:  # pragma: no cover - exercised by the script-style runner.
    from pointer_recipes import recipe_for_policy


def policy_artifact_url(pointer: dict[str, Any]) -> str:
    """Return the canonical immutable Hub URL for a single policy artifact."""

    source = pointer["source"]
    return (
        f"https://huggingface.co/{source['repo']}/resolve/"
        f"{source['revision']}/policy.onnx"
    )


def manifest_digest(raw: bytes) -> str:
    return sha256(raw).hexdigest()


def artifact_matches(pointer: dict[str, Any], data: bytes) -> bool:
    """Check downloaded bytes against the authored artifact identity."""

    return sha256(data).hexdigest() == pointer["source"]["artifact_sha256"]


def simulation_descriptor(
    pointer: dict[str, Any],
    manifest: dict[str, Any],
) -> dict[str, Any] | None:
    """Build the runner descriptor for a covered pointer.

    ``None`` means no maintainer-owned recipe exists *or* the manifest does
    not supply every runner input explicitly. The caller must emit a visible
    unsupported/not-covered result rather than synthesize a command or fail
    the whole registration. In particular there is no silent
    ``action_scale = 1.0`` default: Flamingo declares 1.0 explicitly, and any
    other policy without an explicit finite action_scale stays not-covered.
    """

    from math import isfinite

    source = pointer["source"]
    recipe = recipe_for_policy(source["repo"], manifest, source)
    if recipe is None:
        return None
    robot = manifest.get("robot")
    if not isinstance(robot, dict):
        return None
    # All runner inputs must be known explicitly. Missing or incompatible
    # values yield not-covered, never a guessed descriptor that would fail
    # preflight and kill package registration.
    if manifest.get("obs_len") != 61 or manifest.get("action_len") != 14:
        return None
    if robot.get("model") != "microduck" or robot.get("control_hz") != 50:
        return None
    action_scale = manifest.get("action_scale")
    if isinstance(action_scale, bool) or not isinstance(action_scale, (int, float)):
        return None
    action_scale_f = float(action_scale)
    if not isfinite(action_scale_f):
        return None
    return {
        "id": pointer["id"],
        "name": manifest.get("name") or pointer["id"],
        "contract": {
            "observation_dim": manifest.get("obs_len"),
            "action_dim": manifest.get("action_len"),
            "control_frequency_hz": robot.get("control_hz"),
            "decimation": 4,
            "actuator_model": "Registry deterministic position-control diagnostic runtime",
            "action_scale": action_scale_f,
        },
        "compatibility": {"robot_model": "microduck-standard"},
        "simulation": recipe,
        "artifacts": {
            "onnx": {
                "filename": "policy.onnx",
                "url": policy_artifact_url(pointer),
                "expected_sha256": source["artifact_sha256"],
                "baked_normalizer": None,
            },
        },
        "pointer": pointer,
        "manifest": manifest,
    }
