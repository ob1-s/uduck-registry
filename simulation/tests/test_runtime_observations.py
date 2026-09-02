from __future__ import annotations

import unittest

import numpy as np

from microduck_sim.robot import RolloutResult, StepSample
from microduck_sim.scenarios import scenario_from_descriptor


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
        spec = scenario_from_descriptor(recipe)
        self.assertEqual(spec.kind, "oneshot_zero")
        self.assertEqual(spec.checks, ["recover_upright"])


if __name__ == "__main__":
    unittest.main()
