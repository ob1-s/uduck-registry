from __future__ import annotations

import copy
import json
import unittest
from pathlib import Path

from execution import execution_spec_from_policy
from execution_recipes import (
    POLLEN_ARTIFACT_SHA256,
    POLLEN_MANIFEST_SHA256,
    POLLEN_POLICY_REPO,
    POLLEN_POLICY_REVISION,
    recipe_for_policy,
    recipe_reason,
)
from microduck_sim.preflight import preflight_execution
from microduck_sim.scenarios import make_command_fn, scenario_from_recipe

FIXTURE = Path(__file__).parent / "fixtures" / "flamingo-manifest.json"
FLAMINGO_REPO = "RemiFabre/microduck-flamingo-cycle"
FLAMINGO_SOURCE = {
    "provider": "huggingface-model",
    "repo": FLAMINGO_REPO,
    "revision": "6646428394c6997106d2dc07c1588f20f6fea026",
    "artifact_path": "policy.onnx",
    "manifest_sha256": "ac9b9ae16b4f21733990710275bd934c97558c6028e060bd2b34ec1f5341d302",
    "artifact_sha256": "df77929c39d7695092bdaf810c2075e20a9ba91abd8192b4073d3de593d56904",
    "manifest_path": "manifest.json",
}


class ExecutionRecipeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.manifest = json.loads(FIXTURE.read_text())

    def test_flamingo_recipe_uses_documented_command(self) -> None:
        recipe = recipe_for_policy(FLAMINGO_REPO, self.manifest, FLAMINGO_SOURCE)
        self.assertIsNotNone(recipe)
        assert recipe is not None
        self.assertEqual(recipe["scenario"], "command_schedule")
        self.assertEqual(recipe["duration_s"], 5.0)
        self.assertEqual(recipe["segments"], [{"duration_s": 5.0, "command": [1.0, 1.0, 0.0]}])
        self.assertNotIn("unwind_s", recipe)

    def test_flamingo_recipe_is_bound_to_source_and_manifest(self) -> None:
        altered = copy.deepcopy(self.manifest)
        altered["name"] = "a-different-policy"
        self.assertIsNone(recipe_for_policy(FLAMINGO_REPO, altered, FLAMINGO_SOURCE))
        self.assertIn("manifest name", recipe_reason(FLAMINGO_REPO, altered))
        altered_source = dict(FLAMINGO_SOURCE)
        altered_source["artifact_sha256"] = "0" * 64
        self.assertIsNone(recipe_for_policy(FLAMINGO_REPO, self.manifest, altered_source))

    def test_execution_spec_is_concrete_and_preflightable(self) -> None:
        recipe = recipe_for_policy(FLAMINGO_REPO, self.manifest, FLAMINGO_SOURCE)
        assert recipe is not None
        policy = {"id": "flamingo-cycle", "source": FLAMINGO_SOURCE}
        resolved = {"manifest": self.manifest, "simulation": {"status": "covered", "recipe": recipe}}
        spec = execution_spec_from_policy(policy, resolved)
        self.assertIsNotNone(spec)
        assert spec is not None
        result = preflight_execution(spec)
        self.assertTrue(result.valid, result.errors)
        scenario = scenario_from_recipe(spec.recipe)
        command_fn = make_command_fn(scenario, use_13d=True)
        self.assertEqual(command_fn(0.0)[:3].tolist(), [1.0, 1.0, 0.0])

    def test_generic_zero_recipe_requires_explicit_contract(self) -> None:
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
        missing_scale = copy.deepcopy(manifest)
        del missing_scale["action_scale"]
        self.assertIsNone(recipe_for_policy("someone/microduck-bow", missing_scale))
        command_prose = copy.deepcopy(manifest)
        command_prose["command"]["twist"] = "forward speed"
        self.assertIsNone(recipe_for_policy("someone/microduck-bow", command_prose))

    def test_official_recipes_bind_to_exact_artifact_and_manifest_identity(self) -> None:
        common = {
            "provider": "huggingface-model",
            "repo": POLLEN_POLICY_REPO,
            "revision": POLLEN_POLICY_REVISION,
            "manifest_path": "manifest.json",
            "manifest_sha256": POLLEN_MANIFEST_SHA256,
        }
        manifests = {
            "alpha_walking.onnx": {"file": "alpha_walking.onnx", "kind": "perpetual"},
            "alpha_ground_pick.onnx": {
                "file": "alpha_ground_pick.onnx", "kind": "episodic", "duration_s": 2.8,
                "command": {"encoding": "phase", "period_s": 4.0, "end_phase": 0.7},
            },
            "roller.onnx": {"file": "roller.onnx", "kind": "perpetual", "mode": "roller", "action_scale": 0.8},
            "roller_crouch.onnx": {
                "file": "roller_crouch.onnx", "kind": "episodic", "duration_s": 3.5,
                "mode": "roller", "action_scale": 0.8,
                "command": {"encoding": "phase", "period_s": 5.0, "end_phase": 0.7},
            },
            "roulade.onnx": {"file": "roulade.onnx", "kind": "episodic", "duration_s": 1.0, "chain": True},
            "ball_kick_left.onnx": {"file": "ball_kick_left.onnx", "kind": "episodic", "duration_s": 0.5},
            "ball_kick_right.onnx": {"file": "ball_kick_right.onnx", "kind": "episodic", "duration_s": 0.5},
            "alpha_sitstand.onnx": {
                "file": "alpha_sitstand.onnx", "kind": "scripted", "ramp_s": 2.0, "unwind_s": 1.0,
                "command": {"encoding": "posture_flag", "slot": "twist.vx", "sit": 1.0, "stand": 0.0},
            },
        }
        for artifact_path, manifest in manifests.items():
            source = {
                **common,
                "artifact_path": artifact_path,
                "artifact_sha256": POLLEN_ARTIFACT_SHA256[artifact_path],
            }
            recipe = recipe_for_policy(POLLEN_POLICY_REPO, manifest, source)
            self.assertIsNotNone(recipe, artifact_path)
            altered_revision = {**source, "revision": "0" * 40}
            self.assertIsNone(recipe_for_policy(POLLEN_POLICY_REPO, manifest, altered_revision), artifact_path)
            altered_hash = {**source, "artifact_sha256": "0" * 64}
            self.assertIsNone(recipe_for_policy(POLLEN_POLICY_REPO, manifest, altered_hash), artifact_path)

        kick = recipe_for_policy(
            POLLEN_POLICY_REPO,
            manifests["ball_kick_left.onnx"],
            {**common, "artifact_path": "ball_kick_left.onnx", "artifact_sha256": POLLEN_ARTIFACT_SHA256["ball_kick_left.onnx"]},
        )
        self.assertIsNotNone(kick)
        assert kick is not None
        self.assertEqual(kick["duration_s"], 0.5)
        self.assertEqual(kick["scenario"], "oneshot_zero")

    def test_exact_no_manifest_recipes_supply_only_their_pinned_contract(self) -> None:
        from execution_recipes import GENESIS_ARTIFACT_SHA256, GENESIS_REPO, GENESIS_REVISION

        source = {
            "provider": "github",
            "repo": GENESIS_REPO,
            "revision": GENESIS_REVISION,
            "artifact_path": "policies/velocity.onnx",
            "artifact_sha256": GENESIS_ARTIFACT_SHA256["policies/velocity.onnx"],
            "manifest_path": None,
            "manifest_sha256": None,
        }
        recipe = recipe_for_policy(GENESIS_REPO, None, source)
        self.assertIsNotNone(recipe)
        assert recipe is not None
        self.assertEqual(recipe["contract"]["obs_len"], 61)
        self.assertEqual(recipe["contract"]["action_len"], 14)
        self.assertEqual(recipe["contract"]["action_scale"], 1.0)
        self.assertIsNone(recipe_for_policy(GENESIS_REPO, None, {**source, "artifact_sha256": "0" * 64}))

    def test_scenario_semantics_follow_recipe_fields(self) -> None:
        phase = scenario_from_recipe({
            "runner": "microduck-standard-v1", "scenario": "oneshot_phase", "duration_s": 2.8,
            "period_s": 4.0, "end_phase": 0.7,
        })
        phase_fn = make_command_fn(phase, use_13d=False)
        self.assertAlmostEqual(float(phase_fn(0.0)[0]), 1.0, places=6)
        self.assertAlmostEqual(float(phase_fn(2.0)[0]), -1.0, places=5)
        self.assertEqual(phase_fn(2.8).tolist(), [0.0, 0.0, 0.0])

        posture = scenario_from_recipe({
            "runner": "microduck-standard-v1", "scenario": "sitstand", "duration_s": 3.0, "hold_s": 2.0,
        })
        posture_fn = make_command_fn(posture, use_13d=False)
        self.assertEqual(posture_fn(1.99).tolist(), [1.0, 0.0, 0.0])
        self.assertEqual(posture_fn(2.0).tolist(), [0.0, 0.0, 0.0])

        trigger = scenario_from_recipe({
            "runner": "microduck-standard-v1", "scenario": "oneshot_trigger", "duration_s": 1.0, "trigger_s": 0.75,
        })
        trigger_fn = make_command_fn(trigger, use_13d=False)
        self.assertEqual(trigger_fn(0.74).tolist(), [1.0, 0.0, 0.0])
        self.assertEqual(trigger_fn(0.75).tolist(), [0.0, 0.0, 0.0])

    def test_uncovered_policy_has_no_execution_spec(self) -> None:
        policy = {"id": "mystery", "source": {**FLAMINGO_SOURCE, "repo": "someone/mystery"}}
        resolved = {"manifest": None, "simulation": {"status": "not-covered", "reason": "No recipe."}}
        self.assertIsNone(execution_spec_from_policy(policy, resolved))


if __name__ == "__main__":
    unittest.main()
