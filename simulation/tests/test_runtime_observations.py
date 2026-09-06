from __future__ import annotations

import unittest

import numpy as np

from microduck_sim.robot import DuckRuntime, RolloutResult, StepSample
from microduck_sim.scenarios import scenario_from_recipe


def sample(t: float, left: bool, right: bool, upright_z: float = -1.0) -> StepSample:
    return StepSample(
        t=t,
        command=np.zeros(13, dtype=np.float32),
        action=np.zeros(14, dtype=np.float32),
        trunk_height=0.12,
        trunk_pos=np.array([0.0, 0.0, 0.12]),
        upright_z=upright_z,
        lin_vel_world=np.zeros(3),
        left_foot_contact=left,
        right_foot_contact=right,
    )


class RuntimeObservationsTest(unittest.TestCase):
    def result(self, samples: list[StepSample]) -> RolloutResult:
        return RolloutResult(
            samples=samples,
            obs_dim=61,
            use_13d=True,
            control_steps=len(samples),
            duration_s=len(samples) / 50,
        )

    def test_reset_drop_is_not_takeoff(self) -> None:
        metrics = self.result([
            sample(0.00, False, False),
            sample(0.02, True, True),
            sample(0.04, True, True),
        ]).metrics()
        self.assertFalse(metrics["takeoff_after_support"])
        self.assertFalse(metrics["touchdown_after_takeoff"])

    def test_supported_contact_loss_and_return_is_takeoff_and_touchdown(self) -> None:
        metrics = self.result([
            sample(0.00, False, False),
            sample(0.02, True, True),
            sample(0.04, False, False),
            sample(0.06, False, False),
            sample(0.08, True, True),
        ]).metrics()
        self.assertTrue(metrics["takeoff_after_support"])
        self.assertTrue(metrics["touchdown_after_takeoff"])

    def test_initial_support_then_airborne_is_takeoff(self) -> None:
        result = self.result([
            sample(0.00, False, False),
            sample(0.02, True, True),
            sample(0.04, False, False),
        ])
        result.initial_left_foot_contact = True
        result.initial_right_foot_contact = True
        self.assertTrue(result.metrics()["takeoff_after_support"])

    def test_airborne_reset_followed_by_landing_is_not_takeoff(self) -> None:
        metrics = self.result([
            sample(0.00, False, False),
            sample(0.02, False, False),
            sample(0.04, True, True),
        ]).metrics()
        self.assertFalse(metrics["takeoff_after_support"])

    def test_max_tilt_uses_the_worst_sample(self) -> None:
        metrics = self.result([
            sample(0.00, True, True, upright_z=-1.0),
            sample(0.02, True, True, upright_z=0.0),
            sample(0.04, True, True, upright_z=-1.0),
        ]).metrics()
        self.assertEqual(metrics["max_tilt_deg"], 90.0)

    def test_scenario_is_selected_without_a_robotd_slot(self) -> None:
        recipe = {
            "runner": "microduck-standard-v1",
            "scenario": "oneshot_zero",
            "duration_s": 4,
            "checks": ["recover_upright"],
        }
        spec = scenario_from_recipe(recipe)
        self.assertEqual(spec.kind, "oneshot_zero")
        self.assertEqual(spec.checks, ["recover_upright"])

    def test_final_observation_is_after_the_recovery_tail(self) -> None:
        spec = scenario_from_recipe({
            "runner": "microduck-standard-v1",
            "scenario": "oneshot_zero",
            "duration_s": 4.0,
            "command_duration_s": 1.0,
            "post_command_settle_s": 3.0,
            "capture_duration_s": 4.0,
            "checks": ["recover_upright"],
        })
        result = self.result([
            sample(0.98, True, True, upright_z=0.0),
            sample(1.00, True, True, upright_z=-1.0),
            sample(3.98, True, True, upright_z=-1.0),
        ])
        result.duration_s = 4.0
        metrics = result.metrics()
        self.assertGreater(metrics["final_sample_time_s"], spec.command_duration_s)
        self.assertEqual(metrics["final_sample_time_s"], 3.98)

    def test_policy_handoff_occurs_before_the_first_tick_at_the_deadline(self) -> None:
        class StubRuntime:
            use_13d = True
            obs_dim = 61

            def __init__(self) -> None:
                self.active = "roulade"
                self.seen: list[tuple[float, str]] = []

            def foot_contacts(self) -> tuple[bool, bool]:
                return True, True

            def switch_policy(self, _path, _action_scale) -> None:
                self.active = "stand"

            def step_control(self, t: float, command: np.ndarray) -> StepSample:
                self.seen.append((t, self.active))
                return sample(t, True, True)

        runtime = StubRuntime()
        DuckRuntime.rollout(
            runtime,
            lambda _t: np.zeros(13, dtype=np.float32),
            2.0,
            handoffs=[(1.0, lambda: runtime.switch_policy(None, 1.0))],
        )
        self.assertEqual(runtime.seen[0], (0.0, "roulade"))
        self.assertEqual(runtime.seen[49], (0.98, "roulade"))
        self.assertEqual(runtime.seen[50], (1.0, "stand"))


if __name__ == "__main__":
    unittest.main()
