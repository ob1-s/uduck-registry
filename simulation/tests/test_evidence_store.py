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
    def _unsupported_report(self, behavior="test", inputs="a" * 64, artifact="b" * 64):
        return {
            "behavior": behavior,
            "execution": "unsupported",
            "reason": "no_registry_recipe",
            "inputs_sha256": inputs,
            "policy": {"sha256": artifact},
            "evidence_key": self._key(inputs, artifact),
            "generated_at": "2026-01-01T00:00:00Z",
        }

    @staticmethod
    def _key(inputs, artifact):
        import hashlib
        return hashlib.sha256(
            b"uduck-evidence-v2\0" + inputs.encode() + b"\0" + artifact.encode()
        ).hexdigest()

    def test_package_uses_blob_identity_and_hydrates_local_unsupported(self) -> None:
        # Mandatory: new unsupported pointer on PR -> local report -> temporary
        # merged index -> hydrate without a Release asset.
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            results = root / "sim-results" / "test"
            results.mkdir(parents=True)
            (results / "report.json").write_text(json.dumps(self._unsupported_report()))
            descriptor = root / "test.json"
            descriptor.write_text(json.dumps({"id": "test"}))

            with patch.object(evidence_store, "_authored_descriptors", return_value={"test": descriptor}), \
                 patch.object(evidence_store, "_descriptor_identity", return_value="a" * 64), \
                 patch.object(evidence_store, "_explicit_artifact_sha", return_value="b" * 64):
                assets = root / "assets"
                fragment = root / "fragment.json"
                evidence_store.package(results.parent, assets, fragment)
                value = json.loads(fragment.read_text())
                key = value["current"]["test"]
                entry = value["entries"][key]
                # Blob identity, not semantic key, names the asset.
                self.assertEqual(entry["asset"], f"{entry['blob_sha256']}.tar.gz")
                self.assertEqual(entry["asset_sha256"], entry["blob_sha256"])
                self.assertEqual(entry["asset_sha256"], evidence_store.sha256_bytes((assets / entry["asset"]).read_bytes()))
                # Wall-clock lives in index metadata, not archived bytes.
                import tarfile, io
                with tarfile.open(assets / entry["asset"], "r:gz") as tar:
                    archived = json.loads(tar.extractfile("test/report.json").read().decode())
                self.assertNotIn("generated_at", archived)

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

    def test_same_key_same_blob_is_idempotent_conflict_is_detected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            results = root / "sim-results" / "test"
            results.mkdir(parents=True)
            (results / "report.json").write_text(json.dumps(self._unsupported_report()))
            descriptor = root / "test.json"
            descriptor.write_text(json.dumps({"id": "test"}))
            with patch.object(evidence_store, "_authored_descriptors", return_value={"test": descriptor}), \
                 patch.object(evidence_store, "_descriptor_identity", return_value="a" * 64), \
                 patch.object(evidence_store, "_explicit_artifact_sha", return_value="b" * 64):
                assets = root / "assets"
                evidence_store.package(results.parent, assets, root / "f1.json")
                # Rerun with different wall clock but same inputs: idempotent.
                rep = self._unsupported_report()
                rep["generated_at"] = "2026-06-01T00:00:00Z"
                (results / "report.json").write_text(json.dumps(rep))
                evidence_store.package(results.parent, assets, root / "f2.json")
                v1 = json.loads((root / "f1.json").read_text())
                v2 = json.loads((root / "f2.json").read_text())
                self.assertEqual(v1["current"], v2["current"])
                self.assertEqual(
                    v1["entries"][v1["current"]["test"]]["blob_sha256"],
                    v2["entries"][v2["current"]["test"]]["blob_sha256"],
                )

    def test_merge_prunes_deleted_ids_and_keeps_history(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            base = {
                "version": 2, "format": "uduck-evidence-v2",
                "entries": {
                    "a" * 64: {"behavior": "old", "key": "a" * 64, "asset": "x.tar.gz",
                               "asset_sha256": "y" * 64, "blob_sha256": "y" * 64,
                               "inputs_sha256": "a" * 64},
                    "b" * 64: {"behavior": "keep", "key": "b" * 64, "asset": "z.tar.gz",
                               "asset_sha256": "w" * 64, "blob_sha256": "w" * 64,
                               "inputs_sha256": "b" * 64},
                },
                "current": {"old": "a" * 64, "keep": "b" * 64},
            }
            (root / "base.json").write_text(json.dumps(base))
            (root / "frag.json").write_text(json.dumps(
                {"version": 2, "format": "uduck-evidence-v2", "entries": {}, "current": {}}))
            with patch.object(evidence_store, "_authored_descriptors", return_value={"keep": Path("x")}):
                merged = evidence_store.merge(root / "base.json", root / "frag.json", root / "out.json")
            self.assertNotIn("old", merged["current"])
            self.assertIn("keep", merged["current"])
            # Historical blob retained for audit.
            self.assertIn("a" * 64, merged["entries"])

    def test_revision_validation_distinguishes_git_sha_from_sha256(self) -> None:
        self.assertTrue(evidence_store.valid_git_revision("a" * 40))
        self.assertFalse(evidence_store.valid_git_revision("a" * 64))
        self.assertTrue(evidence_store.valid_sha256("b" * 64))
        self.assertFalse(evidence_store.valid_sha256("b" * 40))

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
