from __future__ import annotations

import unittest

from microduck_sim.preflight import preflight_descriptor, require_valid
from microduck_sim.scenarios import make_command_fn, scenario_from_descriptor


def descriptor() -> dict:
    return {
        "contract": {
            "observation_dim": 61,
            "action_dim": 14,
            "control_frequency_hz": 50,
            "decimation": 4,
            "actuator_model": "Dynamixel XL330 (BAM M6 voltage control law)",
        },
        "compatibility": {"robot_model": "microduck-standard"},
        "simulation": {
            "runner": "microduck-standard-v1",
            "scene": "flat-v1",
            "start": {"preset": "standing_pose"},
            "scenario": "velocity",
            "duration_s": 4,
            "segments": [{"duration_s": 4, "vx": 0.25, "vy": 0, "wz": 0}],
        },
    }


class SimulationPreflightTest(unittest.TestCase):
    def test_accepts_a_complete_supported_recipe(self) -> None:
        result = preflight_descriptor(descriptor())

        self.assertTrue(result.valid)
        self.assertEqual(len(result.warnings), 1)
        self.assertIn("BAM", result.warnings[0])

    def test_rejects_command_outside_the_runtime_range(self) -> None:
        candidate = descriptor()
        candidate["simulation"]["segments"][0]["vx"] = 2.2

        result = preflight_descriptor(candidate)

        self.assertFalse(result.valid)
        self.assertIn("simulation.segments[0].vx=2.2", result.errors[0])

    def test_rejects_an_implicit_or_partial_velocity_schedule(self) -> None:
        missing = descriptor()
        del missing["simulation"]["segments"]
        self.assertFalse(preflight_descriptor(missing).valid)

        partial = descriptor()
        partial["simulation"]["segments"][0]["duration_s"] = 3
        result = preflight_descriptor(partial)
        self.assertFalse(result.valid)
        self.assertTrue(any("must cover the rollout exactly" in error for error in result.errors))

    def test_external_recipe_is_not_admitted_to_the_standard_runner(self) -> None:
        candidate = descriptor()
        candidate["simulation"] = {
            "runner": "external",
            "reason": "custom_environment",
        }

        result = preflight_descriptor(candidate)

        self.assertTrue(result.valid)
        self.assertEqual(result.errors, ())

    def test_runtime_command_defense_does_not_clip(self) -> None:
        candidate = descriptor()
        candidate["simulation"]["segments"][0]["vx"] = 0.4
        spec = scenario_from_descriptor(candidate["simulation"])

        with self.assertRaisesRegex(ValueError, "exceeds"):
            make_command_fn(spec, use_13d=True)(0)

        with self.assertRaisesRegex(ValueError, "exceeds"):
            require_valid(candidate)


if __name__ == "__main__":
    unittest.main()
