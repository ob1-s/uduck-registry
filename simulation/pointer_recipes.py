"""Maintainer-owned diagnostic recipes for resolved Pollen policies.

The JSON files under ``registry/policies`` are pointers and curation state.
They do not contain executable command schedules.  This module is the small,
reviewable bridge between an upstream manifest and the registry's deterministic
MuJoCo runner.  A recipe is admitted only when the command semantics are
available from upstream documentation or from an explicit maintainer review.

The values returned here describe a registry diagnostic.  They do not claim to
reproduce the publisher's training/evaluation environment, and they never
establish hardware evidence.
"""

from __future__ import annotations

from copy import deepcopy
from math import isfinite
from typing import Any

RUNNER = "microduck-standard-v1"
MODEL = "microduck-standard"
SCENE = "flat-v1"
START = {"preset": "settled_standing"}

# This is an upstream operational example, not an inferred value.  The
# command is accepted by robotctl for this published policy and is exercised
# against the checked-in manifest fixture used by the recipe tests.
FLAMINGO_REPO = "RemiFabre/microduck-flamingo-cycle"
FLAMINGO_NAME = "flamingo-cycle"
FLAMINGO_SOURCE = {
    "revision": "6646428394c6997106d2dc07c1588f20f6fea026",
    "manifest_sha256": "ac9b9ae16b4f21733990710275bd934c97558c6028e060bd2b34ec1f5341d302",
    "artifact_sha256": "df77929c39d7695092bdaf810c2075e20a9ba91abd8192b4073d3de593d56904",
}
FLAMINGO_HOLD_S = 5.0
FLAMINGO_COMMAND = (1.0, 1.0, 0.0)
# Pinned upstream revision reviewed for command semantics (2026-09-05).
# policy-manifest.md: only constant-command episodic policies are generic
# one-shots; phase/posture_flag belong in daemon-driven slots. Single-policy
# repos carry exactly one policy.onnx; robotctl reads duration_s/chain/
# action_scale/command.idle/unwind_s and refuses on obs_len/action_len/
# model_api/robot.model/non-constant encoding. Flamingo is a published
# perpetual example with no duration_s, so --hold is required.
# cheatsheet.md: `sudo robotctl policy add flamingo
# RemiFabre/microduck-flamingo-cycle --hold 5 --command 1,1,0`; "--command is
# what the network is fed while it runs. Most skills need none: they are
# trained on an all-zero command and being selected *is* the trigger."
UPSTREAM_PIN = "bc41fb5c9a9b39894669c1e022e375cf83800382"
UPSTREAM_MANIFEST_URL = f"https://github.com/pollen-robotics/microduck/blob/{UPSTREAM_PIN}/docs/policy-manifest.md"
UPSTREAM_CHEATSHEET_URL = f"https://github.com/pollen-robotics/microduck/blob/{UPSTREAM_PIN}/docs/robot/cheatsheet.md"
UPSTREAM_SOURCE_URL = UPSTREAM_CHEATSHEET_URL


def _duration(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = float(value)
    if not isfinite(value) or not 1.0 <= value <= 30.0:
        return None
    return value


def _generic_zero_recipe(manifest: dict[str, Any]) -> dict[str, Any] | None:
    """Return the documented default recipe for a simple episodic policy.

    Pollen's cheatsheet (pinned in UPSTREAM_CHEATSHEET_URL) specifies that a
    plain episodic skill runs on the all-zero command ("Most skills need
    none: they are trained on an all-zero command and being selected *is*
    the trigger"). This is a privilege, not a default: every precondition
    below must hold, otherwise the pointer stays not-covered.
    """

    if manifest.get("kind") != "episodic":
        return None
    command = manifest.get("command")
    if command is not None and not isinstance(command, dict):
        return None
    command = command or {}
    # Absent encoding is treated as constant per upstream manifest docs
    # ("absent or `constant`: a fixed twist for the window"). Any other
    # encoding is daemon-driven and has no generic recipe.
    encoding = command.get("encoding", "constant")
    if encoding not in (None, "constant"):
        return None
    if encoding is None:
        encoding = "constant"
    # Do not interpret prose. Any twist/head/body claim — even "unused
    # (zeros)" — requires a named maintainer recipe with a documented numeric
    # command. The generic default applies only when no such claim exists.
    for key in ("twist", "head", "body"):
        if key in command:
            return None
    # Non-constant custom command semantics must be absent.
    for key in ("sit", "stand", "slot", "period_s", "end_phase"):
        if key in command:
            return None
    duration = _duration(manifest.get("duration_s"))
    if duration is None:
        return None
    # The runner contract must be fully known: compatible I/O widths,
    # control frequency, robot model, and an explicit action scale. Missing
    # values stay missing; they never default to a convenient 1.0 here.
    if manifest.get("obs_len") != 61 or manifest.get("action_len") != 14:
        return None
    if manifest.get("model_api") not in (None, 1):
        return None
    robot = manifest.get("robot")
    if not isinstance(robot, dict):
        return None
    if robot.get("model") != "microduck" or robot.get("control_hz") != 50:
        return None
    action_scale = manifest.get("action_scale")
    if isinstance(action_scale, bool) or not isinstance(action_scale, (int, float)):
        return None
    action_scale_f = float(action_scale)
    if not isfinite(action_scale_f):
        return None
    # Entry-pose uncertainty would make pass/fail misleading. Accept only a
    # documented standing start or an absent claim explicitly accepted as a
    # registry diagnostic assumption.
    entry_pose = manifest.get("entry_pose")
    if entry_pose is not None and entry_pose != "standing":
        return None
    return {
        "runner": RUNNER,
        "model": MODEL,
        "scene": SCENE,
        "start": deepcopy(START),
        "scenario": "oneshot_zero",
        "duration_s": duration,
        "checks": ["no_fall", "ends_upright"],
        "provenance": {
            "owner": "uduck-registry-maintainers",
            "source": "Pollen robot cheatsheet: plain episodic skills use the all-zero command",
            "source_url": UPSTREAM_CHEATSHEET_URL,
            "upstream_pin": UPSTREAM_PIN,
            "command": [0.0, 0.0, 0.0],
            "command_semantics": "upstream documented default for a constant episodic skill with no custom command prose",
            "action_scale": action_scale_f,
            "entry_pose_assumption": "settled_standing registry start; manifest entry_pose is standing or absent",
            "scope": "Registry diagnostic rollout under flat-v1 settled_standing; this does not establish intended-task success or hardware evidence.",
        },
    }


def _flamingo_recipe() -> dict[str, Any]:
    """Build the reviewed Flamingo hold recipe from upstream command semantics."""

    return {
        "runner": RUNNER,
        "model": MODEL,
        "scene": SCENE,
        "start": deepcopy(START),
        "scenario": "command_schedule",
        "duration_s": FLAMINGO_HOLD_S,
        "segments": [
            {"duration_s": FLAMINGO_HOLD_S, "command": list(FLAMINGO_COMMAND)},
        ],
        "checks": ["no_fall"],
        "provenance": {
            "owner": "uduck-registry-maintainers",
            "source": "Pollen robot cheatsheet: sudo robotctl policy add flamingo RemiFabre/microduck-flamingo-cycle --hold 5 --command 1,1,0",
            "source_url": UPSTREAM_CHEATSHEET_URL,
            "upstream_pin": UPSTREAM_PIN,
            "manifest_url": UPSTREAM_MANIFEST_URL,
            "source_fixture": "simulation/tests/fixtures/flamingo-manifest.json",
            "command": list(FLAMINGO_COMMAND),
            "command_semantics": "[flag, side, 0]; flag=1 requests one-foot mode and side=+1 keeps the right foot down",
            "hold_s": FLAMINGO_HOLD_S,
            "duration_s": FLAMINGO_HOLD_S,
            "runner": RUNNER,
            "scene": SCENE,
            "start": deepcopy(START),
            "manifest_idle_command": [0.0, 0.0, 0.0],
            "scope": "Five second active-command uDuck diagnostic under flat-v1 settled_standing with the documented [1,1,0] hold. The manifest is perpetual and has no unwind_s, so no unwind or handoff is simulated. This is not publisher eval reproduction and establishes no hardware verification.",
            "limitations": "Stability under the documented command only; not one-foot-task success. See manifest eval object for publisher claims.",
        },
    }


def recipe_for_policy(
    repo: str,
    manifest: dict[str, Any],
    source: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Return a reviewed recipe for ``repo`` and its resolved manifest.

    Repository matching is case-insensitive because Hub owner/repository names
    are case-insensitive in URLs, while manifest matching prevents a renamed or
    republished artifact from silently inheriting a recipe.
    """

    if not isinstance(repo, str) or not isinstance(manifest, dict):
        return None
    if (
        repo.casefold() == FLAMINGO_REPO.casefold()
        and manifest.get("name") == FLAMINGO_NAME
        and source is not None
        and all(source.get(key) == value for key, value in FLAMINGO_SOURCE.items())
    ):
        return _flamingo_recipe()
    return _generic_zero_recipe(manifest)


def recipe_reason(repo: str, manifest: dict[str, Any], source: dict[str, Any] | None = None) -> str:
    """Explain why a pointer has no registry-owned simulation recipe."""

    if repo.casefold() == FLAMINGO_REPO.casefold():
        if manifest.get("name") != FLAMINGO_NAME:
            return "The reviewed Flamingo recipe is bound to manifest name flamingo-cycle."
        if source is None or not all(source.get(key) == value for key, value in FLAMINGO_SOURCE.items()):
            return "The reviewed Flamingo recipe is bound to its pinned revision and manifest/artifact hashes."
    if manifest.get("kind") == "perpetual":
        return "Perpetual policies require a maintainer-reviewed activation command and finite hold window."
    if manifest.get("kind") == "scripted":
        return "Scripted policies require daemon-driven command timing that the registry runner does not reproduce."
    if manifest.get("kind") == "episodic" and manifest.get("duration_s") is None:
        return "Episodic policy does not declare a finite duration."
    if isinstance(manifest.get("command"), dict) and manifest["command"].get("encoding") not in (None, "constant"):
        return "The upstream command encoding is daemon-driven and has no registry recipe."
    return "No maintainer-owned registry recipe covers this manifest."


def recipe_descriptor(
    repo: str,
    manifest: dict[str, Any],
    source: dict[str, Any] | None = None,
) -> dict[str, Any] | None:
    """Alias with an explicit name for resolver/runner callers."""

    return recipe_for_policy(repo, manifest, source)
