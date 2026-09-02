"""Runner-owned observations and explicitly requested diagnostic checks.

A completed render is never a behavior or hardware validation claim. Checks
only describe what this pinned rollout measured.
"""

from __future__ import annotations

import numpy as np

# A standing Microduck trunk sits near 0.09-0.125 m; below this the hull has
# essentially toppled.
FALL_HEIGHT_M = 0.06
# Projected-gravity z beyond this at the END of the rollout = not recovered.
RECOVER_UPRIGHT_Z = -0.5  # i.e. tilt < 60 degrees
# Velocity-tracking bounds for steady-state segments. Calibrated against the
# official reference implementation (infer_policy.py) run headlessly: with an
# instant 0.25 m/s step command, BEST_alpha_walking stabilizes near ~0.10-0.14
# m/s in deterministic CPU MuJoCo. The check therefore verifies DIRECTION and
# a minimum fraction of commanded speed rather than equality.
TRACKING_MIN_FRACTION = 0.3
TRACKING_DIRECTION_COS = 0.8
# Segment edges trimmed when measuring tracking (startup transients).
TRACK_TRIM_S = 0.6
# The MJCF robots drift; CI arena sanity bound.
MAX_DRIFT_M = 2.5


def evaluate(result, spec) -> dict:
    """Return exact observations and pass/fail results for requested checks."""
    metrics = result.metrics()
    check_results = []

    def add(name: str, passed: bool, detail: str) -> None:
        check_results.append({"check": name, "passed": bool(passed), "detail": detail})

    # Baseline integrity checks always run and cannot be disabled by a
    # descriptor. They say the rollout was numerically usable, nothing more.
    add("finite_outputs", metrics["all_finite"],
        f"max |action| = {metrics['max_abs_action']}")
    add("bounded_drift", metrics["displacement_m"] < MAX_DRIFT_M,
        f"displacement {metrics['displacement_m']} m")

    for name in spec.checks:
        if name == "no_fall":
            add(name, metrics["min_trunk_height_m"] > FALL_HEIGHT_M,
                f"min trunk height {metrics['min_trunk_height_m']} m")
        elif name == "ends_upright":
            add(name, metrics["final_tilt_deg"] < 45.0,
                f"final tilt {metrics['final_tilt_deg']} deg")
        elif name == "recover_upright":
            add(name, metrics["final_tilt_deg"] < 60.0,
                f"final tilt {metrics['final_tilt_deg']} deg, final height "
                f"{metrics['final_trunk_height_m']} m")
        elif name == "takeoff":
            add(name, metrics["takeoff_after_support"],
                "foot contact was lost after a supported state" if metrics["takeoff_after_support"]
                else "no contact loss after a supported state")
        elif name == "touchdown_after_takeoff":
            add(name, metrics["touchdown_after_takeoff"],
                "bilateral contact returned after takeoff" if metrics["touchdown_after_takeoff"]
                else "no bilateral touchdown observed after takeoff")
        elif name == "velocity_tracking":
            _add_velocity_tracking(result, spec, metrics, add)
        else:
            raise ValueError(f"unsupported simulation check: {name}")

    checks_status = "passed" if all(c["passed"] for c in check_results) else "failed"
    return {
        "execution": "rendered",
        "checks_status": checks_status,
        "checks": check_results,
        "observations": metrics,
    }


def _add_velocity_tracking(result, spec, metrics: dict, add) -> None:
    if spec.kind != "velocity":
        add("velocity_tracking", False, "velocity tracking requires a velocity scenario")
        return
    results = _tracking_errors(result, spec)
    if not results:
        add("velocity_tracking", False, "no non-zero command segments found")
        return
    worst_fraction = min(r["fraction"] for r in results)
    worst_cos = min(r["direction_cos"] for r in results)
    tracking = round(float(np.mean([r["abs_err"] for r in results])), 4)
    metrics["mean_tracking_error_mps"] = tracking
    ok = (worst_fraction >= TRACKING_MIN_FRACTION
          and worst_cos >= TRACKING_DIRECTION_COS)
    add("velocity_tracking", ok,
        f"steady-state speed >= {TRACKING_MIN_FRACTION:.0%} of command "
        f"(worst {worst_fraction:.0%}), direction cos >= "
        f"{TRACKING_DIRECTION_COS} (worst {worst_cos:.2f}), "
        f"mean |v_cmd - v_xy| = {tracking:.3f} m/s")


def _tracking_errors(result, spec) -> list:
    """Per-nonzero-segment tracking stats from displacement over the interior.

    Displacement-based stats are robust to gait oscillation and to the
    near-zero-speed startup window (direction cosine of tiny instantaneous
    velocities is noise).
    """
    results = []
    samples = result.samples
    segments = spec.segments or []
    t0 = 0.0
    for duration, vx, vy, _wz in segments:
        t1 = t0 + duration
        cmd_mag = float(np.hypot(vx, vy))
        if cmd_mag > 1e-6:
            lo, hi = t0 + TRACK_TRIM_S, t1 - TRACK_TRIM_S
            window = [s for s in samples if lo <= s.t <= hi]
            if len(window) >= 2:
                d = window[-1].trunk_pos[:2] - window[0].trunk_pos[:2]
                dist = float(np.linalg.norm(d))
                expected = cmd_mag * (window[-1].t - window[0].t)
                frac = dist / expected if expected > 1e-9 else 0.0
                cos = float(np.dot(d, [vx, vy]) / (dist * cmd_mag)) \
                    if dist > 1e-6 else 0.0
                results.append({
                    "abs_err": float(np.mean([
                        np.linalg.norm(s.lin_vel_world[:2] - np.array([vx, vy]))
                        for s in window
                    ])),
                    "fraction": frac,
                    "direction_cos": cos,
                })
        t0 = t1
    return results
