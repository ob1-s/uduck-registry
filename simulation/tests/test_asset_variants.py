from __future__ import annotations

import json
import unittest
from pathlib import Path

from fetch_assets import select_variant


class AssetVariantTest(unittest.TestCase):
    def setUp(self) -> None:
        lock = json.loads(Path("simulation/assets.lock.json").read_text())
        self.lock = lock

    def test_standard_variant_keeps_the_pinned_default(self) -> None:
        selected = select_variant(self.lock, "standard")
        self.assertEqual(selected["model_dir"], "microduck-mjlab")
        self.assertEqual(selected["model_path"], "robot_allcollisions.xml")

    def test_roller_variant_overlays_the_official_model_and_meshes(self) -> None:
        selected = select_variant(self.lock, "rollers")
        paths = {entry["path"] for entry in selected["files"]}
        self.assertEqual(selected["model_dir"], "microduck-mjlab-rollers")
        self.assertEqual(selected["model_path"], "robot_allcollisions_rollers.xml")
        self.assertTrue({
            "robot_allcollisions_rollers.xml",
            "assets/roller_blade.stl",
            "assets/tire.stl",
            "assets/rim.stl",
        } <= paths)


if __name__ == "__main__":
    unittest.main()
