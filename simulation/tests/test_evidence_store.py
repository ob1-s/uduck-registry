from __future__ import annotations

import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))

import evidence_store


class EvidenceStoreTests(unittest.TestCase):
    def test_package_records_asset_digest_and_hydrates_local_result(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            results = root / "sim-results" / "test"
            results.mkdir(parents=True)
            (results / "report.json").write_text(json.dumps({
                "behavior": "test",
                "execution": "unsupported",
                "reason": "no_registry_recipe",
                "inputs_sha256": "a" * 64,
                "generated_at": "2026-01-01T00:00:00Z",
            }))
            descriptor = root / "test.json"
            descriptor.write_text(json.dumps({"id": "test"}))

            with patch.object(evidence_store, "_authored_descriptors", return_value={"test": descriptor}), \
                 patch.object(evidence_store, "_descriptor_identity", return_value="a" * 64):
                assets = root / "assets"
                fragment = root / "fragment.json"
                evidence_store.package(results.parent, assets, fragment)
                value = json.loads(fragment.read_text())
                key = value["current"]["test"]
                entry = value["entries"][key]
                self.assertEqual(entry["asset"], f"{key}.tar.gz")
                self.assertEqual(entry["asset_sha256"], evidence_store.sha256_bytes((assets / entry["asset"]).read_bytes()))

                index = root / "index.json"
                evidence_store.merge(root / "missing-index.json", fragment, index)
                output = root / "public" / "media" / "registry-sim"
                evidence_store.hydrate(
                    index,
                    "https://github.com/ob1-s/uduck-registry/releases/download/registry-evidence",
                    output,
                    results.parent,
                    [],
                )
                staged = output / "test"
                self.assertTrue((staged / "report.json").is_file())
                self.assertEqual(json.loads((staged / "report.json").read_text())["evidence_key"], key)

    def test_archive_rejects_path_traversal_and_links(self) -> None:
        archive = evidence_store._archive_bytes([("test/report.json", b'{"behavior":"test","execution":"unsupported"}')])
        files = evidence_store._extract_archive(archive, "test", Path("unused"))
        self.assertIn("report.json", files)

        import io
        import tarfile

        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode="w:gz") as tar:
            info = tarfile.TarInfo("../report.json")
            info.size = 2
            tar.addfile(info, io.BytesIO(b"{}"))
        with self.assertRaisesRegex(ValueError, "unsafe"):
            evidence_store._extract_archive(stream.getvalue(), "test", Path("unused"))


if __name__ == "__main__":
    unittest.main()
