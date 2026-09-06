from __future__ import annotations

import unittest

from execution import ExecutionSpec
from microduck_sim.preflight import preflight_execution, require_valid
from microduck_sim.scenarios import make_command_fn, scenario_from_recipe


def spec() -> ExecutionSpec:
    return ExecutionSpec(
        entry_id="test-move",
        artifact_url="https://huggingface.co/o/r/resolve/" + "a" * 40 + "/policy.onnx",
        artifact_sha256="b" * 64,
        model="microduck-standard",
        contract={"observation_dim": 61, "action_dim": 14, "control_frequency_hz": 50, "decimation": 4, "action_scale": 1.0, "actuator_model": "Dynamixel XL330"},
        recipe={
            "runner": "microduck-standard-v1",
            "model": "microduck-standard",
            "scene": "flat-v1",
            "start": {"preset": "standing_pose"},
            "scenario": "velocity",
            "duration_s": 4,
            "segments": [{"duration_s": 4, "vx": 0.25, "vy": 0, "wz": 0}],
        },
        source={"provider": "huggingface-model", "repo": "o/r", "revision": "a" * 40, "artifact_path": "policy.onnx", "artifact_sha256": "b" * 64},
        manifest=None,
    )


class SimulationPreflightTest(unittest.TestCase):
    def test_accepts_a_complete_supported_recipe(self) -> None:
        result = preflight_execution(spec())
        self.assertTrue(result.valid, result.errors)

    def test_rejects_command_outside_the_runtime_range(self) -> None:
        candidate = spec()
        candidate.recipe["segments"][0]["vx"] = 2.2
        result = preflight_execution(candidate)
        self.assertFalse(result.valid)
        self.assertIn("vx=2.2", result.errors[0])

    def test_rejects_an_implicit_or_partial_schedule(self) -> None:
        candidate = spec()
        del candidate.recipe["segments"]
        self.assertFalse(preflight_execution(candidate).valid)
        partial = spec()
        partial.recipe["segments"][0]["duration_s"] = 3
        self.assertFalse(preflight_execution(partial).valid)

    def test_runtime_command_defense_does_not_clip(self) -> None:
        candidate = spec()
        candidate.recipe["segments"][0]["vx"] = 0.4
        scenario = scenario_from_recipe(candidate.recipe)
        with self.assertRaisesRegex(ValueError, "exceeds"):
            make_command_fn(scenario, use_13d=True)(0)
        with self.assertRaisesRegex(ValueError, "exceeds"):
            require_valid(candidate)


if __name__ == "__main__":
    unittest.main()
