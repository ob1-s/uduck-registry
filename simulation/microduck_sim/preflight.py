"""Admission checks for the concrete registry ExecutionSpec."""

from __future__ import annotations

from dataclasses import dataclass
from math import isfinite
from typing import TYPE_CHECKING, Any

from .constants import ACTION_DIM, CONTROL_HZ, DECIMATION, OBSERVATION_DIM, VEL_MAX_ANG, VEL_MAX_X, VEL_MAX_Y, VEL_MIN_X, VEL_MIN_Y

if TYPE_CHECKING:
    from ..execution import ExecutionSpec

STANDARD_RUNNER = "microduck-standard-v1"
SUPPORTED_MODELS = {"microduck-standard", "microduck-rollers"}
SUPPORTED_SCENE = "flat-v1"
SUPPORTED_SCENARIOS = {"velocity", "command_schedule", "standing", "sitstand", "oneshot_phase", "oneshot_zero", "oneshot_trigger"}
SUPPORTED_START_PRESETS = {"standing_pose", "settled_standing", "airborne_drop"}


@dataclass(frozen=True)
class PreflightResult:
    errors: tuple[str, ...] = ()
    warnings: tuple[str, ...] = ()

    @property
    def valid(self) -> bool:
        return not self.errors


class SimulationPreflightError(ValueError):
    def __init__(self, result: PreflightResult) -> None:
        self.result = result
        super().__init__("execution spec rejected by simulation preflight:\n- " + "\n- ".join(result.errors))


def _finite(value: object) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and isfinite(value)


def _velocity_errors(vx: object, vy: object, wz: object, prefix: str) -> list[str]:
    errors: list[str] = []
    for axis, value, minimum, maximum in (
        ("vx", vx, VEL_MIN_X, VEL_MAX_X),
        ("vy", vy, VEL_MIN_Y, VEL_MAX_Y),
        ("wz", wz, -VEL_MAX_ANG, VEL_MAX_ANG),
    ):
        if not _finite(value):
            errors.append(f"{prefix}.{axis} must be a finite number")
        elif value < minimum or value > maximum:
            errors.append(f"{prefix}.{axis}={value:g} exceeds the supported range [{minimum:g}, {maximum:g}]")
    return errors


def preflight_execution(spec: "ExecutionSpec") -> PreflightResult:
    """Check every execution input before artifact download or inference."""

    recipe = spec.recipe
    errors: list[str] = []
    warnings: list[str] = []
    if recipe.get("runner") != STANDARD_RUNNER:
        errors.append(f"unsupported execution runner: {recipe.get('runner')!r}")
    if spec.model not in SUPPORTED_MODELS:
        errors.append(f"{STANDARD_RUNNER} does not support robot model {spec.model!r}")
    if recipe.get("model") != spec.model:
        errors.append(f"recipe model {recipe.get('model')!r} does not match ExecutionSpec model {spec.model!r}")
    if recipe.get("scene") != SUPPORTED_SCENE:
        errors.append(f"{STANDARD_RUNNER} supports only scene {SUPPORTED_SCENE!r}; got {recipe.get('scene')!r}")

    scenario = recipe.get("scenario")
    if scenario not in SUPPORTED_SCENARIOS:
        errors.append(f"unsupported execution scenario: {scenario!r}")
    start = recipe.get("start")
    if not isinstance(start, dict):
        errors.append("execution recipe start must be an object")
        start = {}
    preset = start.get("preset")
    if preset not in SUPPORTED_START_PRESETS:
        errors.append(f"unsupported execution start preset: {preset!r}")
    elif preset == "airborne_drop":
        height = start.get("trunk_height_m")
        if not _finite(height) or not 0.15 <= height <= 0.5:
            errors.append("execution start trunk_height_m must be finite and between 0.15 and 0.5 m")
        if start.get("orientation") not in {"upright", "front", "back", "left", "right"}:
            errors.append("execution start orientation is unsupported")
        velocity = start.get("linear_velocity_mps")
        if velocity is not None and (not isinstance(velocity, (list, tuple)) or len(velocity) != 3 or any(not _finite(value) or value < -3 or value > 3 for value in velocity)):
            errors.append("execution start linear_velocity_mps must contain three finite values in [-3, 3]")

    duration = recipe.get("duration_s")
    duration_value = float(duration) if _finite(duration) else None
    if duration_value is None or not 0 < duration_value <= 30:
        errors.append("execution duration_s must be finite, positive, and at most 30 seconds")

    capture_duration = recipe.get("capture_duration_s", duration)
    capture_value = float(capture_duration) if _finite(capture_duration) else None
    if capture_value is None or not 0 < capture_value <= 30:
        errors.append("execution capture_duration_s must be finite, positive, and at most 30 seconds")
    elif duration_value is not None and abs(capture_value - duration_value) > 1e-9:
        errors.append("execution capture_duration_s must equal execution duration_s")

    command_duration = recipe.get("command_duration_s", duration)
    command_value = float(command_duration) if _finite(command_duration) else None
    if command_value is None or command_value <= 0:
        errors.append("execution command_duration_s must be finite and positive")

    settle = recipe.get("post_command_settle_s", 0.0)
    settle_value = float(settle) if _finite(settle) else None
    if settle_value is None or settle_value < 0:
        errors.append("execution post_command_settle_s must be finite and non-negative")
    if command_value is not None and settle_value is not None and capture_value is not None and abs(command_value + settle_value - capture_value) > 1e-9:
        errors.append("execution command duration plus settle tail must equal capture duration")
    has_settle_tail = command_value is not None and settle_value is not None and settle_value > 0
    schedule_value = command_value if has_settle_tail else duration_value
    schedule_name = "command_duration_s" if has_settle_tail else "duration_s"

    segments = recipe.get("segments")
    if scenario == "velocity":
        if not isinstance(segments, list) or not segments:
            errors.append("execution segments are required for the velocity scenario")
        else:
            total = 0.0
            for index, segment in enumerate(segments):
                prefix = f"execution.segments[{index}]"
                if not isinstance(segment, dict):
                    errors.append(f"{prefix} must be an object")
                    continue
                segment_duration = segment.get("duration_s")
                if not _finite(segment_duration) or segment_duration <= 0:
                    errors.append(f"{prefix}.duration_s must be a positive finite number")
                else:
                    total += float(segment_duration)
                errors.extend(_velocity_errors(segment.get("vx"), segment.get("vy"), segment.get("wz"), prefix))
            if schedule_value is not None and abs(total - schedule_value) > 1e-9:
                errors.append(f"execution segments cover {total:g}s but execution {schedule_name}={schedule_value:g}s")
    elif scenario == "command_schedule":
        if not isinstance(segments, list) or not segments:
            errors.append("execution segments are required for the command_schedule scenario")
        else:
            total = 0.0
            for index, segment in enumerate(segments):
                prefix = f"execution.segments[{index}]"
                if not isinstance(segment, dict):
                    errors.append(f"{prefix} must be an object")
                    continue
                segment_duration = segment.get("duration_s")
                if not _finite(segment_duration) or segment_duration <= 0:
                    errors.append(f"{prefix}.duration_s must be a positive finite number")
                else:
                    total += float(segment_duration)
                command = segment.get("command")
                if not isinstance(command, (list, tuple)) or len(command) != 3:
                    errors.append(f"{prefix}.command must have exactly three finite values")
                else:
                    for axis, value in enumerate(command):
                        if not _finite(value) or value < -3 or value > 3:
                            errors.append(f"{prefix}.command[{axis}] must be finite and in [-3, 3]")
            if schedule_value is not None and abs(total - schedule_value) > 1e-9:
                errors.append(f"execution segments cover {total:g}s but execution {schedule_name}={schedule_value:g}s")
    elif "segments" in recipe:
        errors.append("execution segments are only valid with velocity and command_schedule scenarios")

    if scenario == "oneshot_phase":
        period = recipe.get("period_s")
        end_phase = recipe.get("end_phase")
        if not _finite(period) or not 0 < period <= 30:
            errors.append("oneshot_phase requires an explicit period_s between 0 and 30 seconds")
        if not _finite(end_phase) or not 0 < end_phase <= 1:
            errors.append("oneshot_phase requires an explicit end_phase in (0, 1]")
    elif scenario == "sitstand":
        hold = recipe.get("hold_s")
        if not _finite(hold) or not _finite(duration_value) or not 0 <= hold <= duration_value:
            errors.append("sitstand requires an explicit hold_s within the rollout duration")
    elif scenario == "oneshot_trigger":
        trigger = recipe.get("trigger_s")
        if not _finite(trigger) or not _finite(duration_value) or not 0 <= trigger <= duration_value:
            errors.append("oneshot_trigger requires an explicit trigger_s within the rollout duration")

    contract: dict[str, Any] = spec.contract
    if contract.get("observation_dim") != OBSERVATION_DIM:
        errors.append(f"{STANDARD_RUNNER} expects {OBSERVATION_DIM} observations; spec declares {contract.get('observation_dim')!r}")
    if contract.get("action_dim") != ACTION_DIM:
        errors.append(f"{STANDARD_RUNNER} expects {ACTION_DIM} actions; spec declares {contract.get('action_dim')!r}")
    if contract.get("control_frequency_hz") != CONTROL_HZ:
        errors.append(f"{STANDARD_RUNNER} expects {CONTROL_HZ} Hz control; spec declares {contract.get('control_frequency_hz')!r} Hz")
    if contract.get("decimation") != DECIMATION:
        errors.append(f"{STANDARD_RUNNER} expects decimation {DECIMATION}; spec declares {contract.get('decimation')!r}")
    action_scale = contract.get("action_scale")
    if not _finite(action_scale):
        errors.append("ExecutionSpec requires an explicit finite action_scale")
    if "bam" in str(contract.get("actuator_model", "")).lower():
        warnings.append("spec declares BAM actuator dynamics; the registry runtime uses deterministic position control")
    if not isinstance(spec.artifact_url, str) or not spec.artifact_url.startswith("https://"):
        errors.append("ExecutionSpec artifact_url must be an HTTPS URL")
    return PreflightResult(tuple(errors), tuple(warnings))


def require_valid(spec: "ExecutionSpec") -> PreflightResult:
    result = preflight_execution(spec)
    if result.errors:
        raise SimulationPreflightError(result)
    return result
