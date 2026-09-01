"""Pass/fail checks over a rollout. Kept conservative: a check failure means
the policy could not be validated in simulation, not that the behavior is bad.
Profiles that intentionally leave the feet (roulade, jumps) set allow_fall.
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
    """Return {verdict: pass|fail, checks: [...], metrics: {...}} for a rollout."""
    metrics = result.metrics()
    checks = []

    def add(name: str, passed: bool, detail: str) -> None:
        checks.append({"check": name, "passed": bool(passed), "detail": detail})

    add("finite_outputs", metrics["all_finite"],
        f"max |action| = {metrics['max_abs_action']}")

    if spec.allow_fall:
        add("recover_upright", metrics["final_tilt_deg"] < 60.0,
            f"final tilt {metrics['final_tilt_deg']} deg, final height "
            f"{metrics['final_trunk_height_m']} m")
    else:
        add("no_fall", metrics["min_trunk_height_m"] > FALL_HEIGHT_M,
            f"min trunk height {metrics['min_trunk_height_m']} m")
        add("ends_upright", metrics["final_tilt_deg"] < 45.0,
            f"final tilt {metrics['final_tilt_deg']} deg")

    add("bounded_drift", metrics["displacement_m"] < MAX_DRIFT_M,
        f"displacement {metrics['displacement_m']} m")

    tracking = None
    if spec.expect_tracking and spec.kind == "velocity":
        results = _tracking_errors(result, spec)
        if results:
            worst_fraction = min(r["fraction"] for r in results)
            worst_cos = min(r["direction_cos"] for r in results)
            mean_err = float(np.mean([r["abs_err"] for r in results]))
            tracking = round(mean_err, 4)
            ok = (worst_fraction >= TRACKING_MIN_FRACTION
                  and worst_cos >= TRACKING_DIRECTION_COS)
            add("velocity_tracking", ok,
                f"steady-state speed >= {TRACKING_MIN_FRACTION:.0%} of command "
                f"(worst {worst_fraction:.0%}), direction cos >= "
                f"{TRACKING_DIRECTION_COS} (worst {worst_cos:.2f}), "
                f"mean |v_cmd - v_xy| = {tracking:.3f} m/s")
    if spec.expect_tracking and spec.kind == "velocity" and tracking is None:
        add("velocity_tracking", False, "no non-zero command segments found")

    verdict = "pass" if all(c["passed"] for c in checks) else "fail"
    out = {"verdict": verdict, "checks": checks, "metrics": metrics}
    if tracking is not None:
        out["metrics"]["mean_tracking_error_mps"] = tracking
    return out


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
