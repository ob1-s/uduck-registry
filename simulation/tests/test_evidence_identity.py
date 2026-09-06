from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import evidence  # noqa: E402
from evidence import EVIDENCE_VERSION, IDENTITY_VERSION, execution_inputs, inputs_digest  # noqa: E402


class EvidenceIdentityTests(unittest.TestCase):
    def test_identity_namespace_is_v3(self) -> None:
        self.assertEqual(IDENTITY_VERSION, "uduck-execution-inputs-v3")
        self.assertEqual(EVIDENCE_VERSION, "uduck-evidence-v3")

    def test_identity_is_entry_scoped(self) -> None:
        self.assertNotEqual(inputs_digest("alpha-walking"), inputs_digest("jump"))

    def test_identity_contains_execution_inputs_but_not_curation(self) -> None:
        inputs = execution_inputs("alpha-walking")
        self.assertIn("source", inputs)
        self.assertIn("manifest", inputs)
        self.assertIn("simulation", inputs)
        self.assertNotIn("curation", inputs)

    def test_recipe_change_is_scoped_to_the_changed_entry(self) -> None:
        original_alpha = inputs_digest("alpha-walking")
        original_jump = inputs_digest("jump")
        alpha_inputs = execution_inputs("alpha-walking")
        changed_alpha = {
            **alpha_inputs,
            "simulation": {
                **alpha_inputs["simulation"],
                "recipe": {
                    **alpha_inputs["simulation"]["recipe"],
                    "duration_s": 7.0,
                },
            },
        }

        def changed_inputs(entry_id: str) -> dict:
            return changed_alpha if entry_id == "alpha-walking" else execution_inputs(entry_id)

        with patch.object(evidence, "execution_inputs", side_effect=changed_inputs):
            self.assertNotEqual(inputs_digest("alpha-walking"), original_alpha)
            self.assertEqual(inputs_digest("jump"), original_jump)


if __name__ == "__main__":
    unittest.main()
