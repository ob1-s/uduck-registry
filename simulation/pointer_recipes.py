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
UPSTREAM_SOURCE_URL = "https://github.com/pollen-robotics/microduck"


def _duration(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = float(value)
    if not isfinite(value) or not 1.0 <= value <= 30.0:
        return None
    return value


def _generic_zero_recipe(manifest: dict[str, Any]) -> dict[str, Any] | None:
    """Return the documented default recipe for a simple episodic policy.

    Pollen's policy-channel cheatsheet specifies that a plain episodic skill
    runs on the all-zero command.  If a manifest describes a non-zero twist in
    prose, this function declines coverage: prose is not a safe executable
    command encoding.
    """

    if manifest.get("kind") != "episodic":
        return None
    command = manifest.get("command")
    if command is not None and not isinstance(command, dict):
        return None
    command = command or {}
    encoding = command.get("encoding", "constant")
    if encoding != "constant":
        return None
    # A prose twist description is deliberately not interpreted here.  A
    # maintainer can add a named recipe when upstream documents its numeric
    # activation command; the generic default applies only when no twist claim
    # is present at all.
    if "twist" in command:
        return None
    duration = _duration(manifest.get("duration_s"))
    if duration is None:
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
            "source": "Pollen policy-channel cheatsheet: plain episodic skills use the all-zero command",
            "source_url": UPSTREAM_SOURCE_URL,
            "command": [0.0, 0.0, 0.0],
            "command_semantics": "upstream documented default for a constant episodic skill",
            "scope": "Registry diagnostic rollout under flat-v1; this does not establish intended-task success or hardware evidence.",
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
            "source": "Pollen robotctl cheatsheet: policy add flamingo ... --hold 5 --command 1,1,0",
            "source_url": UPSTREAM_SOURCE_URL,
            "source_fixture": "simulation/tests/fixtures/flamingo-manifest.json",
            "command": list(FLAMINGO_COMMAND),
            "command_semantics": "[flag, side, 0]; flag=1 requests one-foot mode and side=+1 keeps the right foot down",
            "hold_s": FLAMINGO_HOLD_S,
            "manifest_idle_command": [0.0, 0.0, 0.0],
            "scope": "Five second active-command diagnostic under flat-v1. The manifest is perpetual and has no unwind_s, so no unwind or handoff is simulated.",
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
