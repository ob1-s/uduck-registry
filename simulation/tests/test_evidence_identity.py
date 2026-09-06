from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from evidence import execution_inputs, inputs_digest  # noqa: E402


class EvidenceIdentityTests(unittest.TestCase):
    def test_identity_is_entry_scoped(self) -> None:
        self.assertNotEqual(inputs_digest("alpha-walking"), inputs_digest("jump"))

    def test_identity_contains_execution_inputs_but_not_curation(self) -> None:
        inputs = execution_inputs("alpha-walking")
        self.assertIn("source", inputs)
        self.assertIn("manifest", inputs)
        self.assertIn("simulation", inputs)
        self.assertNotIn("curation", inputs)


if __name__ == "__main__":
    unittest.main()
