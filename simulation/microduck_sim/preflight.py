"""Deterministic admission checks for registry-owned simulation recipes.

These checks answer whether a descriptor can be represented by the pinned
registry runner. They do not execute the policy or make a claim about its
behavioral success.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import isfinite

from .constants import (
    ACTION_DIM,
    CONTROL_HZ,
    DECIMATION,
    OBSERVATION_DIM,
    VEL_MAX_ANG,
    VEL_MAX_X,
    VEL_MAX_Y,
    VEL_MIN_X,
    VEL_MIN_Y,
)

STANDARD_RUNNER = "microduck-standard-v1"
SUPPORTED_MODELS = {"microduck-standard", "microduck-rollers"}
SUPPORTED_SCENE = "flat-v1"
SUPPORTED_SCENARIOS = {
    "velocity",
    "command_schedule",
    "standing",
    "sitstand",
    "oneshot_phase",
    "oneshot_zero",
    "oneshot_trigger",
}
SUPPORTED_START_PRESETS = {"standing_pose", "settled_standing", "airborne_drop"}


@dataclass(frozen=True)
class PreflightResult:
    """The static result before any artifact or simulator work begins."""

    errors: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()

    @property
    def valid(self) -> bool:
        return not self.errors


class SimulationPreflightError(ValueError):
    """Raised when a registry recipe cannot be represented by its runner."""

    def __init__(self, result: PreflightResult) -> None:
        self.result = result
        super().__init__(
            "simulation preflight rejected the descriptor:\n- "
            + "\n- ".join(result.errors)
        )


def _is_finite_number(value: object) -> bool:
    return (
        isinstance(value, (int, float))
        and not isinstance(value, bool)
        and isfinite(value)
    )


def _velocity_errors(vx: object, vy: object, wz: object, prefix: str) -> list[str]:
    errors: list[str] = []
    limits = (
        ("vx", vx, VEL_MIN_X, VEL_MAX_X),
        ("vy", vy, VEL_MIN_Y, VEL_MAX_Y),
        ("wz", wz, -VEL_MAX_ANG, VEL_MAX_ANG),
    )
    for axis, value, minimum, maximum in limits:
        if not _is_finite_number(value):
            errors.append(f"{prefix}.{axis} must be a finite number")
        elif value < minimum or value > maximum:
            errors.append(
                f"{prefix}.{axis}={value:g} exceeds {STANDARD_RUNNER}'s "
                f"supported range [{minimum:g}, {maximum:g}]"
            )
    return errors


def preflight_descriptor(descriptor: dict) -> PreflightResult:
    """Check a descriptor against the capabilities of ``standard-v1``.

    External/no-recipe descriptors intentionally bypass these checks. They are
    reported as unsupported by ``run_check.py`` and must provide their own
    publisher-owned environment or media.
    """

    simulation = descriptor.get("simulation")
    if simulation is None:
        return PreflightResult()
    if not isinstance(simulation, dict):
        return PreflightResult(errors=("simulation must be an object",))
    if simulation.get("runner") == "external":
        return PreflightResult()

    errors: list[str] = []
    warnings: list[str] = []
    contract = descriptor.get("contract", {})
    if not isinstance(contract, dict):
        errors.append("contract must be an object")
        contract = {}
    compatibility = descriptor.get("compatibility", {})
    if not isinstance(compatibility, dict):
        errors.append("compatibility must be an object")
        compatibility = {}
    runner = simulation.get("runner")

    if runner != STANDARD_RUNNER:
        errors.append(f"unsupported simulation runner: {runner!r}")

    model = simulation.get("model", compatibility.get("robot_model"))
    if model not in SUPPORTED_MODELS:
        errors.append(f"{STANDARD_RUNNER} does not support robot model {model!r}")
    if model != compatibility.get("robot_model"):
        errors.append(
            f"simulation model {model!r} does not match compatibility model "
            f"{compatibility.get('robot_model')!r}"
        )

    if simulation.get("scene") != SUPPORTED_SCENE:
        errors.append(
            f"{STANDARD_RUNNER} supports only scene {SUPPORTED_SCENE!r}; "
            f"got {simulation.get('scene')!r}"
        )

    scenario = simulation.get("scenario")
    if scenario not in SUPPORTED_SCENARIOS:
        errors.append(f"unsupported simulation scenario: {scenario!r}")

    start = simulation.get("start")
    if not isinstance(start, dict):
        errors.append("simulation.start must be an object")
        start = {}
    preset = start.get("preset")
    if preset not in SUPPORTED_START_PRESETS:
        errors.append(f"unsupported simulation start preset: {preset!r}")
    elif preset == "airborne_drop":
        height = start.get("trunk_height_m")
        if not _is_finite_number(height):
            errors.append("simulation.start.trunk_height_m must be a finite number")
        elif height < 0.15 or height > 0.5:
            errors.append("simulation.start.trunk_height_m must be between 0.15 and 0.5 m")
        if start.get("orientation") not in {"upright", "front", "back", "left", "right"}:
            errors.append("simulation.start.orientation is unsupported")
        velocity = start.get("linear_velocity_mps")
        if velocity is not None:
            if not isinstance(velocity, (list, tuple)) or len(velocity) != 3:
                errors.append("simulation.start.linear_velocity_mps must have three values")
            else:
                for index, value in enumerate(velocity):
                    if not _is_finite_number(value) or value < -3 or value > 3:
                        errors.append(
                            f"simulation.start.linear_velocity_mps[{index}] must be finite and in [-3, 3]"
                        )

    duration = simulation.get("duration_s")
    duration_value = duration if _is_finite_number(duration) else None
    if duration_value is None:
        errors.append("simulation.duration_s must be a finite number")
    elif duration_value < 1 or duration_value > 30:
        errors.append("simulation.duration_s must be between 1 and 30 seconds")

    if scenario == "velocity":
        segments = simulation.get("segments")
        if not isinstance(segments, list) or not segments:
            errors.append("simulation.segments is required for the velocity scenario")
        else:
            total_duration = 0.0
            for index, segment in enumerate(segments):
                prefix = f"simulation.segments[{index}]"
                if not isinstance(segment, dict):
                    errors.append(f"{prefix} must be an object")
                    continue
                segment_duration = segment.get("duration_s")
                if _is_finite_number(segment_duration) and segment_duration > 0:
                    total_duration += float(segment_duration)
                else:
                    errors.append(f"{prefix}.duration_s must be a positive finite number")
                errors.extend(_velocity_errors(
                    segment.get("vx"), segment.get("vy"), segment.get("wz"), prefix
                ))
            if duration_value is not None and abs(total_duration - duration_value) > 1e-9:
                errors.append(
                    f"simulation.segments cover {total_duration:g}s but "
                    f"simulation.duration_s={duration_value:g}s; the schedule must cover the rollout exactly"
                )
    elif scenario == "command_schedule":
        segments = simulation.get("segments")
        if not isinstance(segments, list) or not segments:
            errors.append("simulation.segments is required for the command_schedule scenario")
        else:
            total_duration = 0.0
            for index, segment in enumerate(segments):
                prefix = f"simulation.segments[{index}]"
                if not isinstance(segment, dict):
                    errors.append(f"{prefix} must be an object")
                    continue
                segment_duration = segment.get("duration_s")
                if _is_finite_number(segment_duration) and segment_duration > 0:
                    total_duration += float(segment_duration)
                else:
                    errors.append(f"{prefix}.duration_s must be a positive finite number")
                command = segment.get("command")
                if not isinstance(command, (list, tuple)) or len(command) != 3:
                    errors.append(f"{prefix}.command must have exactly three finite values")
                else:
                    for axis, value in enumerate(command):
                        if not _is_finite_number(value):
                            errors.append(f"{prefix}.command[{axis}] must be a finite number")
                        elif value < -3 or value > 3:
                            errors.append(
                                f"{prefix}.command[{axis}]={value:g} exceeds "
                                "the command range [-3, 3]"
                            )
            if duration_value is not None and abs(total_duration - duration_value) > 1e-9:
                errors.append(
                    f"simulation.segments cover {total_duration:g}s but "
                    f"simulation.duration_s={duration_value:g}s; the schedule must cover the rollout exactly"
                )
    elif "segments" in simulation:
        errors.append("simulation.segments is only valid with the velocity scenario")

    if contract.get("observation_dim") != OBSERVATION_DIM:
        errors.append(
            f"{STANDARD_RUNNER} expects {OBSERVATION_DIM} observations; "
            f"descriptor declares {contract.get('observation_dim')!r}"
        )
    if contract.get("action_dim") != ACTION_DIM:
        errors.append(
            f"{STANDARD_RUNNER} expects {ACTION_DIM} actions; "
            f"descriptor declares {contract.get('action_dim')!r}"
        )
    if contract.get("control_frequency_hz") != CONTROL_HZ:
        errors.append(
            f"{STANDARD_RUNNER} expects {CONTROL_HZ} Hz control; "
            f"descriptor declares {contract.get('control_frequency_hz')!r} Hz"
        )
    if contract.get("decimation") != DECIMATION:
        errors.append(
            f"{STANDARD_RUNNER} expects decimation {DECIMATION}; "
            f"descriptor declares {contract.get('decimation')!r}"
        )

    actuator_model = str(contract.get("actuator_model", "")).lower()
    if "bam" in actuator_model:
        warnings.append(
            "descriptor declares BAM actuator dynamics; standard-v1 uses the "
            "registry's deterministic position-control diagnostic runtime"
        )

    return PreflightResult(tuple(errors), tuple(warnings))


def require_valid(descriptor: dict) -> PreflightResult:
    """Run preflight and raise one readable error before simulation starts."""

    result = preflight_descriptor(descriptor)
    if result.errors:
        raise SimulationPreflightError(result)
    return result
