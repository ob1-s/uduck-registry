"""Maintainer-owned execution recipes for resolved policy artifacts.

Authored policy files contain immutable upstream identity and curation only.
This small, reviewed layer is the only place where an upstream command example
can become an executable registry recipe. A missing recipe is a visible
``not-covered`` result, never a guessed command or runtime escape hatch.
"""

from __future__ import annotations

from copy import deepcopy
from math import isfinite
from typing import Any

RUNNER = "microduck-standard-v1"
MODEL = "microduck-standard"
SCENE = "flat-v1"
START = {"preset": "settled_standing"}

FLAMINGO_REPO = "RemiFabre/microduck-flamingo-cycle"
FLAMINGO_NAME = "flamingo-cycle"
FLAMINGO_SOURCE = {
    "provider": "huggingface-model",
    "repo": FLAMINGO_REPO,
    "revision": "6646428394c6997106d2dc07c1588f20f6fea026",
    "artifact_path": "policy.onnx",
    "manifest_sha256": "ac9b9ae16b4f21733990710275bd934c97558c6028e060bd2b34ec1f5341d302",
    "artifact_sha256": "df77929c39d7695092bdaf810c2075e20a9ba91abd8192b4073d3de593d56904",
    "manifest_path": "manifest.json",
}
FLAMINGO_HOLD_S = 5.0
FLAMINGO_COMMAND = (1.0, 1.0, 0.0)
UPSTREAM_PIN = "bc41fb5c9a9b39894669c1e022e375cf83800382"
UPSTREAM_MANIFEST_URL = f"https://github.com/pollen-robotics/microduck/blob/{UPSTREAM_PIN}/docs/policy-manifest.md"
UPSTREAM_CHEATSHEET_URL = f"https://github.com/pollen-robotics/microduck/blob/{UPSTREAM_PIN}/docs/robot/cheatsheet.md"


def _duration(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = float(value)
    return value if isfinite(value) and 1.0 <= value <= 30.0 else None


def _generic_zero_recipe(manifest: dict[str, Any]) -> dict[str, Any] | None:
    """Cover only the documented, finite, constant zero-command one-shot."""

    if manifest.get("kind") != "episodic":
        return None
    command = manifest.get("command")
    if command is not None and not isinstance(command, dict):
        return None
    command = command or {}
    if command.get("encoding", "constant") not in (None, "constant"):
        return None
    if any(key in command for key in ("twist", "head", "body", "sit", "stand", "slot", "period_s", "end_phase")):
        return None
    duration = _duration(manifest.get("duration_s"))
    if duration is None or manifest.get("obs_len") != 61 or manifest.get("action_len") != 14 or manifest.get("model_api") != 1:
        return None
    robot = manifest.get("robot")
    if not isinstance(robot, dict) or robot.get("model") != "microduck" or robot.get("control_hz") != 50:
        return None
    action_scale = manifest.get("action_scale")
    if isinstance(action_scale, bool) or not isinstance(action_scale, (int, float)) or not isfinite(float(action_scale)):
        return None
    if manifest.get("entry_pose") not in (None, "standing"):
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
            "command_semantics": "upstream documented default for a constant episodic skill with no publisher-specific command prose",
            "action_scale": float(action_scale),
            "entry_pose_assumption": "settled_standing registry start; manifest entry_pose is standing or absent",
            "scope": "Registry diagnostic rollout under flat-v1 settled_standing; this does not establish intended-task success or hardware evidence.",
        },
    }


def _flamingo_recipe() -> dict[str, Any]:
    return {
        "runner": RUNNER,
        "model": MODEL,
        "scene": SCENE,
        "start": deepcopy(START),
        "scenario": "command_schedule",
        "duration_s": FLAMINGO_HOLD_S,
        "segments": [{"duration_s": FLAMINGO_HOLD_S, "command": list(FLAMINGO_COMMAND)}],
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


def recipe_for_policy(repo: str, manifest: dict[str, Any], source: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """Return a reviewed recipe only for an exact source/manifest match."""

    if not isinstance(repo, str) or not isinstance(manifest, dict):
        return None
    if repo.casefold() == FLAMINGO_REPO.casefold() and manifest.get("name") == FLAMINGO_NAME and source is not None and all(source.get(key) == value for key, value in FLAMINGO_SOURCE.items()):
        return _flamingo_recipe()
    return _generic_zero_recipe(manifest)


def recipe_reason(repo: str, manifest: dict[str, Any], source: dict[str, Any] | None = None) -> str:
    """Explain why no registry-owned execution recipe applies."""

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
