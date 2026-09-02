"""Named scenarios: how the 13D command evolves over a diagnostic rollout.

A scenario is selected explicitly by a descriptor's `simulation` block.
Compatibility and robotd installation slots are intentionally not inputs.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable

import numpy as np

from .constants import VEL_MAX_ANG, VEL_MAX_X, VEL_MAX_Y, VEL_MIN_X, VEL_MIN_Y


@dataclass
class ScenarioSpec:
    """Declarative description of a command schedule."""

    kind: str = "velocity"
    # velocity: list of (duration_s, vx, vy, wz) segments, played in order.
    segments: list = field(default_factory=list)
    # oneshot_phase (crouch / ground pick): period + end phase per upstream.
    period_s: float = 4.0
    end_phase: float = 0.7
    # sitstand: seconds holding the sit flag before returning to stand.
    hold_s: float = 2.0
    # oneshot_zero: seconds the zeroed command window lasts (kicks, roulade).
    duration_s: float = 0.5
    # oneshot_trigger: binary launch request followed by the zero command
    # (custom one-shot policies such as jumps).
    trigger_s: float = 0.2
    # Runner-defined checks requested by the descriptor. These are assertions
    # over measured telemetry, not contributor-authored validation claims.
    checks: list[str] = field(default_factory=list)
    # Alias of the scenario for reports.
    name: str = ""


def validate_velocity(vx: float, vy: float, wz: float) -> tuple:
    """Return a velocity command unchanged, rejecting unsupported values.

    A registry recipe is declarative input, not a user-control stream. Silently
    clipping it would make the rendered rollout differ from what the descriptor
    says, so out-of-range values are an explicit error.
    """
    limits = (
        ("vx", vx, VEL_MIN_X, VEL_MAX_X),
        ("vy", vy, VEL_MIN_Y, VEL_MAX_Y),
        ("wz", wz, -VEL_MAX_ANG, VEL_MAX_ANG),
    )
    for axis, value, minimum, maximum in limits:
        if isinstance(value, bool) or not isinstance(value, (int, float)) or not np.isfinite(value):
            raise ValueError(f"{axis} command must be finite")
        if value < minimum or value > maximum:
            raise ValueError(
                f"{axis} command {value:g} exceeds the registry runner's "
                f"supported range [{minimum:g}, {maximum:g}]"
            )
    return float(vx), float(vy), float(wz)


def scenario_from_descriptor(sim_block: dict) -> ScenarioSpec:
    """Build a scenario solely from an explicit registry simulation recipe."""
    if sim_block.get("runner") != "microduck-standard-v1":
        raise ValueError("descriptor does not declare a registry simulation recipe")

    spec = ScenarioSpec()
    spec.kind = sim_block["scenario"]
    spec.name = spec.kind
    spec.checks = list(sim_block.get("checks", []))
    spec.duration_s = float(sim_block["duration_s"])
    spec.trigger_s = float(sim_block.get("trigger_s", spec.trigger_s))
    spec.period_s = float(sim_block.get("period_s", spec.period_s))
    spec.end_phase = float(sim_block.get("end_phase", spec.end_phase))
    spec.hold_s = float(sim_block.get("hold_s", spec.hold_s))
    segments = sim_block.get("segments")
    if spec.kind == "velocity":
        if not isinstance(segments, list) or not segments:
            raise ValueError("velocity scenario requires explicit segments")
        spec.segments = [(float(s["duration_s"]), float(s["vx"]), float(s["vy"]),
                          float(s["wz"])) for s in segments]
    elif "segments" in sim_block:
        raise ValueError("simulation.segments is only valid with the velocity scenario")
    return spec


def make_command_fn(spec: ScenarioSpec, use_13d: bool) -> Callable[[float], np.ndarray]:
    """Return f(t) -> command vector for the scenario.

    `use_13d` selects the unified 13D command (twist + head + body pose);
    otherwise the legacy 3D twist command is produced.
    """
    def wrap(cmd: np.ndarray) -> np.ndarray:
        if not use_13d:
            return cmd.astype(np.float32)
        return np.concatenate([cmd, np.zeros(10, dtype=np.float32)]).astype(np.float32)

    if spec.kind == "velocity":
        if not spec.segments:
            raise ValueError("velocity scenario requires explicit segments")
        segments = spec.segments

        def vel_fn(t: float) -> np.ndarray:
            remaining = t
            chosen = segments[-1]
            for duration, vx, vy, wz in segments:
                if remaining < duration:
                    chosen = (duration, vx, vy, wz)
                    break
                remaining -= duration
            _, vx, vy, wz = chosen
            return wrap(np.array(validate_velocity(vx, vy, wz), dtype=np.float32))

        return vel_fn

    if spec.kind == "standing":
        def stand_fn(t: float) -> np.ndarray:
            return wrap(np.zeros(3, dtype=np.float32))
        return stand_fn

    if spec.kind == "sitstand":
        # Posture flag in the twist-x slot: 1 = sit, 0 = stand (upstream docs).
        hold = spec.hold_s

        def sitstand_fn(t: float) -> np.ndarray:
            flag = 1.0 if t < hold else 0.0
            return wrap(np.array([flag, 0.0, 0.0], dtype=np.float32))

        return sitstand_fn

    if spec.kind == "oneshot_phase":
        # Phase encoding in the twist slots: [cos(2pi phi), sin(2pi phi), 0],
        # phase advancing 1/period per second, cycle exits at end_phase.
        period, end_phase = spec.period_s, spec.end_phase

        def phase_fn(t: float) -> np.ndarray:
            if t / period >= end_phase:
                cmd = np.zeros(3, dtype=np.float32)
            else:
                phi = 2.0 * math.pi * (t / period)
                cmd = np.array([math.cos(phi), math.sin(phi), 0.0], dtype=np.float32)
            return wrap(cmd)

        return phase_fn

    if spec.kind == "oneshot_zero":
        # Blind one-shot window with an all-zero command (kicks, roulade).
        def zero_fn(t: float) -> np.ndarray:
            return wrap(np.zeros(3, dtype=np.float32))
        return zero_fn

    if spec.kind == "oneshot_trigger":
        # Custom one-shot policies documented by their authors as a binary
        # launch request in twist-vx, followed by the settling command.
        trigger_s = spec.trigger_s

        def trigger_fn(t: float) -> np.ndarray:
            cmd = (np.array([1.0, 0.0, 0.0], dtype=np.float32)
                   if t < trigger_s else np.zeros(3, dtype=np.float32))
            return wrap(cmd)

        return trigger_fn

    raise ValueError(f"Unknown simulation scenario kind: {spec.kind!r}")
