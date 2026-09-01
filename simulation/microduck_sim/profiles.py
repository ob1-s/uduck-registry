"""Command profiles: how the 13D (or legacy 3D) command evolves over a rollout.

A profile is a callable that maps elapsed control time -> command vector.
Descriptors may pin a profile and its parameters via the optional
`simulation` block; otherwise a profile is derived from `compatibility.robotd_slot`.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Callable, Optional

import numpy as np

from .constants import VEL_MAX_ANG, VEL_MAX_X, VEL_MAX_Y, VEL_MIN_X, VEL_MIN_Y


@dataclass
class ProfileSpec:
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
    # Values the checks use to decide pass/fail.
    allow_fall: bool = False
    expect_tracking: bool = True
    # Alias of the profile for reports.
    name: str = ""


def clamp_vel(vx: float, vy: float, wz: float) -> tuple:
    return (
        float(np.clip(vx, VEL_MIN_X, VEL_MAX_X)),
        float(np.clip(vy, VEL_MIN_Y, VEL_MAX_Y)),
        float(np.clip(wz, -VEL_MAX_ANG, VEL_MAX_ANG)),
    )


def default_profile_for_slot(slot: str) -> ProfileSpec:
    """Derive a sensible default command profile from the robotd slot."""
    if slot in ("walk", "roller"):
        return ProfileSpec(
            kind="velocity",
            segments=[
                (1.0, 0.0, 0.0, 0.0),         # settle
                (3.0, 0.25, 0.0, 0.0),        # walk forward (Space VEL_FWD)
                (2.0, 0.25, 0.0, 0.5),        # arc right
            ],
            name=f"{slot}:showcase",
        )
    if slot in ("sitstand", "stand"):
        # Sitting rests the trunk on the hull (~0.06-0.07 m), which is below
        # the standing-height fall threshold; the recovery check applies.
        return ProfileSpec(kind="sitstand", allow_fall=True,
                           expect_tracking=False, name=f"{slot}:cycle")
    if slot == "roulade":
        return ProfileSpec(kind="oneshot_zero", duration_s=2.0, allow_fall=True,
                           expect_tracking=False, name=f"{slot}:oneshot")
    if slot in ("kick_left", "kick_right"):
        return ProfileSpec(kind="oneshot_zero", duration_s=0.5, expect_tracking=False,
                           name=f"{slot}:oneshot")
    if slot == "ground_pick":
        return ProfileSpec(kind="oneshot_phase", period_s=4.0, end_phase=0.7,
                           expect_tracking=False, name=f"{slot}:phase")
    return ProfileSpec(kind="standing", expect_tracking=False, name="standing:hold")


def profile_from_descriptor(sim_block: Optional[dict], slot: str) -> ProfileSpec:
    """Build a ProfileSpec from a descriptor's optional `simulation` block."""
    spec = default_profile_for_slot(slot)
    if not sim_block:
        return spec
    spec.kind = sim_block.get("profile", spec.kind)
    spec.name = spec.kind
    spec.allow_fall = bool(sim_block.get("allow_fall", spec.allow_fall))
    spec.expect_tracking = bool(sim_block.get("expect_tracking", spec.expect_tracking))
    spec.duration_s = float(sim_block.get("duration_s", spec.duration_s))
    spec.period_s = float(sim_block.get("period_s", spec.period_s))
    spec.end_phase = float(sim_block.get("end_phase", spec.end_phase))
    spec.hold_s = float(sim_block.get("hold_s", spec.hold_s))
    segments = sim_block.get("segments")
    if segments:
        spec.segments = [(float(s["duration_s"]), float(s["vx"]), float(s["vy"]),
                          float(s["wz"])) for s in segments]
    return spec


def make_command_fn(spec: ProfileSpec, use_13d: bool) -> Callable[[float], np.ndarray]:
    """Return f(t) -> command vector for the profile.

    `use_13d` selects the unified 13D command (twist + head + body pose);
    otherwise the legacy 3D twist command is produced.
    """
    def wrap(cmd: np.ndarray) -> np.ndarray:
        if not use_13d:
            return cmd.astype(np.float32)
        return np.concatenate([cmd, np.zeros(10, dtype=np.float32)]).astype(np.float32)

    if spec.kind == "velocity":
        segments = spec.segments or [(spec.duration_s or 6.0, 0.0, 0.0, 0.0)]

        def vel_fn(t: float) -> np.ndarray:
            remaining = t
            chosen = segments[-1]
            for duration, vx, vy, wz in segments:
                if remaining < duration:
                    chosen = (duration, vx, vy, wz)
                    break
                remaining -= duration
            _, vx, vy, wz = chosen
            return wrap(np.array(clamp_vel(vx, vy, wz), dtype=np.float32))

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

    raise ValueError(f"Unknown simulation profile kind: {spec.kind!r}")
