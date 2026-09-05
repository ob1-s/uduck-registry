from __future__ import annotations

import copy
from hashlib import sha256
import json
import unittest
from pathlib import Path

from microduck_sim.preflight import preflight_descriptor
from microduck_sim.scenarios import make_command_fn, scenario_from_descriptor
from pointer_recipes import recipe_for_policy, recipe_reason
from pointer_runner import artifact_matches, policy_artifact_url, simulation_descriptor


FIXTURE = Path(__file__).parent / "fixtures" / "flamingo-manifest.json"
FLAMINGO_REPO = "RemiFabre/microduck-flamingo-cycle"
FLAMINGO_SOURCE = {
    "repo": FLAMINGO_REPO,
    "revision": "6646428394c6997106d2dc07c1588f20f6fea026",
    "manifest_sha256": "ac9b9ae16b4f21733990710275bd934c97558c6028e060bd2b34ec1f5341d302",
    "artifact_sha256": "df77929c39d7695092bdaf810c2075e20a9ba91abd8192b4073d3de593d56904",
}


class PointerRecipeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = json.loads(FIXTURE.read_text())

    def test_flamingo_recipe_uses_documented_command_and_no_invented_unwind(self) -> None:
        recipe = recipe_for_policy(
            FLAMINGO_REPO,
            self.manifest,
            FLAMINGO_SOURCE,
        )

        self.assertIsNotNone(recipe)
        assert recipe is not None
        self.assertEqual(recipe["scenario"], "command_schedule")
        self.assertEqual(recipe["duration_s"], 5.0)
        self.assertEqual(recipe["segments"], [{"duration_s": 5.0, "command": [1.0, 1.0, 0.0]}])
        self.assertEqual(recipe["provenance"]["command"], [1.0, 1.0, 0.0])
        self.assertEqual(recipe["provenance"]["manifest_idle_command"], [0.0, 0.0, 0.0])
        self.assertNotIn("unwind_s", self.manifest)
        self.assertNotIn("unwind_s", recipe)
        self.assertIn("no unwind", recipe["provenance"]["scope"])

    def test_flamingo_recipe_is_bound_to_the_manifest_name(self) -> None:
        altered = copy.deepcopy(self.manifest)
        altered["name"] = "a-different-policy"
        self.assertIsNone(recipe_for_policy(FLAMINGO_REPO, altered, FLAMINGO_SOURCE))
        self.assertIn("manifest name", recipe_reason(FLAMINGO_REPO, altered))

    def test_flamingo_recipe_is_bound_to_the_reviewed_artifact_identity(self) -> None:
        altered_source = dict(FLAMINGO_SOURCE)
        altered_source["artifact_sha256"] = "0" * 64
        self.assertIsNone(recipe_for_policy(FLAMINGO_REPO, self.manifest, altered_source))
        self.assertIn("pinned revision", recipe_reason(FLAMINGO_REPO, self.manifest, altered_source))

    def test_flamingo_command_schedule_is_explicit_and_preflightable(self) -> None:
        recipe = recipe_for_policy(
            FLAMINGO_REPO,
            self.manifest,
            FLAMINGO_SOURCE,
        )
        assert recipe is not None
        descriptor = {
            "contract": {
                "observation_dim": 61,
                "action_dim": 14,
                "control_frequency_hz": 50,
                "decimation": 4,
                "actuator_model": "Dynamixel XL330 position-control diagnostic law",
            },
            "compatibility": {"robot_model": "microduck-standard"},
            "simulation": recipe,
        }
        result = preflight_descriptor(descriptor)
        self.assertTrue(result.valid, result.errors)
        spec = scenario_from_descriptor(recipe)
        command_fn = make_command_fn(spec, use_13d=True)
        self.assertEqual(command_fn(0.0)[:3].tolist(), [1.0, 1.0, 0.0])
        self.assertEqual(command_fn(4.999)[:3].tolist(), [1.0, 1.0, 0.0])
        self.assertEqual(command_fn(5.0)[:3].tolist(), [1.0, 1.0, 0.0])

    def test_constant_episodic_zero_default_is_explicitly_provenanced(self) -> None:
        manifest = {
            "schema_version": 2,
            "kind": "episodic",
            "duration_s": 4.0,
            "command": {"encoding": "constant"},
            "obs_len": 61,
            "action_len": 14,
            "model_api": 1,
            "action_scale": 1.0,
            "entry_pose": "standing",
            "robot": {"model": "microduck", "hw_rev": 1, "servos": "xl330", "control_hz": 50},
        }
        recipe = recipe_for_policy("someone/microduck-bow", manifest)
        self.assertIsNotNone(recipe)
        assert recipe is not None
        self.assertEqual(recipe["scenario"], "oneshot_zero")
        self.assertEqual(recipe["provenance"]["command"], [0.0, 0.0, 0.0])
        self.assertIn("upstream_pin", recipe["provenance"])

    def test_generic_zero_requires_complete_runner_contract(self) -> None:
        base = {
            "schema_version": 2,
            "kind": "episodic",
            "duration_s": 4.0,
            "command": {"encoding": "constant"},
            "obs_len": 61,
            "action_len": 14,
            "model_api": 1,
            "action_scale": 1.0,
            "entry_pose": "standing",
            "robot": {"model": "microduck", "hw_rev": 1, "servos": "xl330", "control_hz": 50},
        }
        import copy as _copy
        # Missing action_scale stays not-covered, never defaults to 1.0.
        missing_scale = _copy.deepcopy(base)
        del missing_scale["action_scale"]
        self.assertIsNone(recipe_for_policy("someone/microduck-bow", missing_scale))
        # Custom twist/head/body prose is never interpreted.
        for key in ("twist", "head", "body"):
            m = _copy.deepcopy(base)
            m["command"] = {"encoding": "constant", key: "unused (zeros)"}
            self.assertIsNone(recipe_for_policy("someone/microduck-move", m), key)
        # Non-standing entry pose stays not-covered.
        m = _copy.deepcopy(base)
        m["entry_pose"] = "crouching"
        self.assertIsNone(recipe_for_policy("someone/microduck-bow", m))
        # Wrong widths stay not-covered.
        m = _copy.deepcopy(base)
        m["obs_len"] = 60
        self.assertIsNone(recipe_for_policy("someone/microduck-bow", m))
        # Missing duration stays not-covered.
        m = _copy.deepcopy(base)
        del m["duration_s"]
        self.assertIsNone(recipe_for_policy("someone/microduck-bow", m))
        # Missing model_api stays not-covered: 61 inputs and 14 outputs do
        # not prove the semantics of those channels.
        m = _copy.deepcopy(base)
        del m["model_api"]
        self.assertIsNone(recipe_for_policy("someone/microduck-bow", m))

    def test_nonzero_command_prose_is_not_executed_as_a_guess(self) -> None:
        manifest = {
            "schema_version": 2,
            "kind": "episodic",
            "duration_s": 4.0,
            "command": {"encoding": "constant", "twist": "forward speed"},
            "obs_len": 61,
            "action_len": 14,
            "model_api": 1,
            "action_scale": 1.0,
            "entry_pose": "standing",
            "robot": {"model": "microduck", "hw_rev": 1, "servos": "xl330", "control_hz": 50},
        }
        self.assertIsNone(recipe_for_policy("someone/microduck-move", manifest))

    def test_command_schedule_rejects_partial_or_out_of_range_values(self) -> None:
        recipe = recipe_for_policy(
            FLAMINGO_REPO,
            self.manifest,
            FLAMINGO_SOURCE,
        )
        assert recipe is not None
        partial = copy.deepcopy(recipe)
        partial["duration_s"] = 4.0
        partial_result = preflight_descriptor({
            "contract": {"observation_dim": 61, "action_dim": 14,
                         "control_frequency_hz": 50, "decimation": 4},
            "compatibility": {"robot_model": "microduck-standard"},
            "simulation": partial,
        })
        self.assertFalse(partial_result.valid)
        self.assertTrue(any("cover" in error for error in partial_result.errors))
        invalid = copy.deepcopy(recipe)
        invalid["segments"][0]["command"][0] = 4.0
        result = preflight_descriptor({
            "contract": {"observation_dim": 61, "action_dim": 14,
                         "control_frequency_hz": 50, "decimation": 4},
            "compatibility": {"robot_model": "microduck-standard"},
            "simulation": invalid,
        })
        self.assertFalse(result.valid)
        self.assertTrue(any("command[0]" in error for error in result.errors))

    def test_pointer_adapter_preserves_source_identity_and_artifact_url(self) -> None:
        pointer = {"id": "flamingo-cycle", "source": FLAMINGO_SOURCE}
        descriptor = simulation_descriptor(pointer, self.manifest)
        self.assertIsNotNone(descriptor)
        assert descriptor is not None
        self.assertEqual(descriptor["simulation"]["scenario"], "command_schedule")
        self.assertEqual(
            descriptor["artifacts"]["onnx"]["expected_sha256"],
            FLAMINGO_SOURCE["artifact_sha256"],
        )
        self.assertEqual(descriptor["artifacts"]["onnx"]["url"], policy_artifact_url(pointer))
        fixture_data = b"fixture artifact"
        fixture_pointer = {"source": {"artifact_sha256": sha256(fixture_data).hexdigest()}}
        self.assertTrue(artifact_matches(fixture_pointer, fixture_data))

    def test_unsupported_fixture_stays_registrable_without_recipe(self) -> None:
        manifest = json.loads((Path(__file__).parent / "fixtures" / "unsupported-manifest.json").read_text())
        self.assertIsNone(recipe_for_policy("someone/microduck-mystery", manifest))
        pointer = {
            "id": "mystery-spin",
            "source": {
                "repo": "someone/microduck-mystery",
                "revision": "b" * 40,
                "manifest_sha256": "c" * 64,
                "artifact_sha256": "d" * 64,
            },
        }
        # Incomplete coverage must not kill registration: adapter returns None.
        self.assertIsNone(simulation_descriptor(pointer, manifest))

    def test_generic_eligible_fixture_selects_zero_command_for_documented_reasons(self) -> None:
        manifest = json.loads((Path(__file__).parent / "fixtures" / "generic-eligible-manifest.json").read_text())
        recipe = recipe_for_policy("someone/microduck-polite-bow", manifest)
        self.assertIsNotNone(recipe)
        assert recipe is not None
        self.assertEqual(recipe["scenario"], "oneshot_zero")
        self.assertEqual(recipe["provenance"]["command"], [0.0, 0.0, 0.0])
        pointer = {
            "id": "polite-bow",
            "source": {
                "repo": "someone/microduck-polite-bow",
                "revision": "b" * 40,
                "manifest_sha256": "c" * 64,
                "artifact_sha256": "d" * 64,
            },
        }
        descriptor = simulation_descriptor(pointer, manifest)
        self.assertIsNotNone(descriptor)
        assert descriptor is not None
        self.assertEqual(descriptor["contract"]["action_scale"], 0.8)

    def test_incomplete_pointer_returns_not_covered_instead_of_preflight_failure(self) -> None:
        manifest = {
            "schema_version": 2, "kind": "episodic", "duration_s": 4.0,
            "command": {"encoding": "constant"},
            # Missing obs_len/action_len/robot/action_scale: cannot instantiate.
        }
        pointer = {
            "id": "incomplete",
            "source": {"repo": "o/r", "revision": "a" * 40,
                        "manifest_sha256": "b" * 64, "artifact_sha256": "c" * 64},
        }
        self.assertIsNone(simulation_descriptor(pointer, manifest))


if __name__ == "__main__":
    unittest.main()
