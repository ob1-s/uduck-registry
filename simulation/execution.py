"""The runner boundary: a concrete execution specification for one policy."""

from __future__ import annotations

from dataclasses import dataclass
from math import isfinite
from typing import Any


@dataclass(frozen=True)
class ExecutionHandoff:
    """A source-bound policy selected after the primary policy window ends."""

    at_s: float
    name: str
    artifact_url: str
    artifact_sha256: str
    action_scale: float
    source: dict[str, Any]


@dataclass(frozen=True)
class ExecutionSpec:
    """All inputs needed by the deterministic registry runner.

    An instance exists only when a maintainer-owned recipe covers the resolved
    policy. Uncovered policies never get a partial or synthetic specification.
    """

    entry_id: str
    artifact_url: str
    artifact_sha256: str
    model: str
    contract: dict[str, Any]
    recipe: dict[str, Any]
    source: dict[str, Any]
    manifest: dict[str, Any] | None
    handoff: ExecutionHandoff | None = None


def artifact_url(source: dict[str, Any]) -> str:
    provider = source["provider"]
    repo = source["repo"]
    revision = source["revision"]
    artifact_path = source["artifact_path"]
    if provider == "github":
        return f"https://raw.githubusercontent.com/{repo}/{revision}/{artifact_path}"
    prefix = "spaces/" if provider == "huggingface-space" else ""
    return f"https://huggingface.co/{prefix}{repo}/resolve/{revision}/{artifact_path}"


def _handoff_from_recipe(recipe: dict[str, Any]) -> ExecutionHandoff | None:
    value = recipe.get("handoff")
    if value is None:
        return None
    if not isinstance(value, dict):
        return None
    source = value.get("source")
    at_s = value.get("at_s")
    name = value.get("name")
    action_scale = value.get("action_scale")
    if (
        not isinstance(source, dict)
        or not isinstance(at_s, (int, float))
        or isinstance(at_s, bool)
        or not isfinite(float(at_s))
        or float(at_s) <= 0
        or not isinstance(name, str)
        or not name
        or isinstance(action_scale, bool)
        or not isinstance(action_scale, (int, float))
        or not isfinite(float(action_scale))
        or float(action_scale) <= 0
        or not isinstance(source.get("artifact_sha256"), str)
    ):
        return None
    try:
        url = artifact_url(source)
    except (KeyError, TypeError):
        return None
    return ExecutionHandoff(
        at_s=float(at_s),
        name=name,
        artifact_url=url,
        artifact_sha256=source["artifact_sha256"],
        action_scale=float(action_scale),
        source=source,
    )


def execution_spec_from_policy(policy: dict[str, Any], resolved: dict[str, Any]) -> ExecutionSpec | None:
    """Build an executable spec from resolved policy data, or return ``None``."""

    simulation = resolved.get("simulation")
    if not isinstance(simulation, dict) or simulation.get("status") != "covered":
        return None
    recipe = simulation.get("recipe")
    source = policy.get("source")
    manifest = resolved.get("manifest")
    if not isinstance(recipe, dict) or not isinstance(source, dict):
        return None
    if manifest is not None and not isinstance(manifest, dict):
        return None

    # Manifest facts are authoritative when present. Exact source-bound
    # maintainer recipes may provide a deliberately narrow contract for older
    # artifacts that have no machine-readable manifest; there is no general
    # legacy/default fallback here.
    contract_source = manifest if isinstance(manifest, dict) else recipe.get("contract")
    if not isinstance(contract_source, dict):
        return None
    robot = contract_source.get("robot")
    if not isinstance(robot, dict):
        return None
    if contract_source.get("obs_len") != 61 or contract_source.get("action_len") != 14 or robot.get("model") != "microduck" or robot.get("control_hz") != 50:
        return None
    action_scale = contract_source.get("action_scale")
    recipe_action_scale = recipe.get("action_scale")
    if action_scale is None:
        action_scale = recipe_action_scale
    elif recipe_action_scale is not None and action_scale != recipe_action_scale:
        return None
    if isinstance(action_scale, bool) or not isinstance(action_scale, (int, float)):
        return None
    contract = {
        "observation_dim": contract_source.get("obs_len"),
        "action_dim": contract_source.get("action_len"),
        "control_frequency_hz": robot.get("control_hz"),
        "action_scale": float(action_scale),
        "decimation": contract_source.get("decimation", 4),
        "actuator_model": contract_source.get("actuator_model", "Registry deterministic position-control diagnostic runtime"),
    }
    model = recipe.get("model")
    if not isinstance(model, str):
        return None
    handoff = _handoff_from_recipe(recipe)
    if recipe.get("handoff") is not None and handoff is None:
        return None
    return ExecutionSpec(
        entry_id=str(policy["id"]),
        artifact_url=artifact_url(source),
        artifact_sha256=str(source["artifact_sha256"]),
        model=model,
        contract=contract,
        recipe=recipe,
        source=source,
        manifest=manifest,
        handoff=handoff,
    )
