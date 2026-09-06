from __future__ import annotations

import hashlib
import io
import json
import sys
import tarfile
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
import evidence_store


def evidence_key(inputs: str, artifact: str) -> str:
    return hashlib.sha256(
        b"uduck-evidence-v3\0" + inputs.encode() + b"\0" + artifact.encode()
    ).hexdigest()


def report(entry: str = "test", inputs: str = "a" * 64, artifact: str = "b" * 64) -> dict:
    return {
        "entry": entry,
        "execution": "not-covered",
        "reason": "No maintainer-owned execution recipe covers this source.",
        "inputs_sha256": inputs,
        "policy": {"url": "https://huggingface.co/o/r/resolve/revision/policy.onnx", "sha256": artifact},
        "evidence_key": evidence_key(inputs, artifact),
        "generated_at": "2026-01-01T00:00:00Z",
        "media": None,
    }


class EvidenceStoreTests(unittest.TestCase):
    def test_actual_pre20_index_transitions_to_v3_identity_and_store(self) -> None:
        fixture = Path(__file__).parent / "fixtures" / "pre20-evidence-index.json"
        old_index = json.loads(fixture.read_text())
        self.assertEqual(old_index["format"], "uduck-evidence-v2")
        self.assertIn("behavior", old_index["entries"][old_index["current"]["alpha-walking"]])
        self.assertEqual(old_index["entries"][old_index["current"]["courier"]]["execution"], "unsupported")

        def fragment_entry(entry_id: str, inputs: str, artifact: str) -> tuple[str, dict]:
            key = evidence_key(inputs, artifact)
            blob = (entry_id[0] * 64)
            return key, {
                "entry": entry_id,
                "key": key,
                "asset": f"{blob}.tar.gz",
                "asset_sha256": blob,
                "blob_sha256": blob,
                "inputs_sha256": inputs,
                "artifact_sha256": artifact,
                "execution": "not-covered",
                "identity_source": "runner",
                "checks_status": None,
                "reason": "No maintainer-owned execution recipe covers this source.",
            }

        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            old_path = root / "old-index.json"
            old_path.write_text(json.dumps(old_index))
            alpha_policy = root / "alpha-walking.json"
            courier_policy = root / "courier.json"
            alpha_policy.write_text(json.dumps({"id": "alpha-walking", "source": {"artifact_sha256": "a" * 64}}))
            courier_policy.write_text(json.dumps({"id": "courier", "source": {"artifact_sha256": "c" * 64}}))

            alpha_key, alpha_entry = fragment_entry("alpha-walking", "1" * 64, "a" * 64)
            courier_key, courier_entry = fragment_entry("courier", "2" * 64, "c" * 64)
            fragment = root / "fragment.json"
            fragment.write_text(json.dumps({
                "version": 2,
                "format": "uduck-evidence-v2",
                "entries": {alpha_key: alpha_entry, courier_key: courier_entry},
                "current": {"alpha-walking": alpha_key, "courier": courier_key},
            }))

            with patch.object(evidence_store, "ROOT", root), \
                 patch.object(evidence_store, "_authored_policies", return_value={
                     "alpha-walking": alpha_policy,
                     "courier": courier_policy,
                 }), \
                 patch.object(evidence_store, "_policy_inputs", side_effect={
                     "alpha-walking": "1" * 64,
                     "courier": "2" * 64,
                 }.get):
                planned = evidence_store.plan(old_path, root / "plan.json")
                self.assertEqual({item["status"] for item in planned["items"]}, {"run"})

                merged = evidence_store.merge(old_path, fragment, root / "merged.json")
                self.assertEqual(merged["current"]["alpha-walking"], alpha_key)
                self.assertEqual(merged["current"]["courier"], courier_key)
                self.assertNotIn("fall-recovery", merged["current"])
                self.assertIn(old_index["current"]["fall-recovery"], merged["entries"])
                self.assertIn(old_index["current"]["alpha-walking"], merged["entries"])
                self.assertIn(old_index["current"]["courier"], merged["entries"])

                with self.assertRaisesRegex(ValueError, "stale evidence identity"):
                    evidence_store.hydrate(
                        old_path,
                        "https://github.com/ob1-s/uduck-registry/releases/download/registry-evidence",
                        root / "hydrated",
                        None,
                        ["alpha-walking"],
                    )

    def test_package_uses_blob_identity_and_hydrates_local_not_covered(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            results = root / "sim-results" / "test"
            results.mkdir(parents=True)
            (results / "report.json").write_text(json.dumps(report()))
            policy = root / "registry" / "policies" / "test.json"
            policy.parent.mkdir(parents=True)
            policy.write_text(json.dumps({"id": "test", "source": {"artifact_sha256": "b" * 64}}))

            with patch.object(evidence_store, "ROOT", root), \
                 patch.object(evidence_store, "_authored_policies", return_value={"test": policy}), \
                 patch.object(evidence_store, "_policy_inputs", return_value="a" * 64):
                assets = root / "assets"
                fragment = root / "fragment.json"
                evidence_store.package(results.parent, assets, fragment)
                value = json.loads(fragment.read_text())
                key = value["current"]["test"]
                entry = value["entries"][key]
                self.assertEqual(entry["asset"], f"{entry['blob_sha256']}.tar.gz")
                self.assertEqual(entry["asset_sha256"], entry["blob_sha256"])
                self.assertEqual(entry["asset_sha256"], evidence_store.sha256_bytes((assets / entry["asset"]).read_bytes()))
                with tarfile.open(assets / entry["asset"], "r:gz") as archive:
                    archived = json.loads(archive.extractfile("test/report.json").read().decode())
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

    def test_same_key_same_blob_is_idempotent_and_conflicts_are_detected(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            results = root / "results" / "test"
            results.mkdir(parents=True)
            (results / "report.json").write_text(json.dumps(report()))
            assets = root / "assets"
            first = root / "first.json"
            second = root / "second.json"
            evidence_store.package(results.parent, assets, first)
            original = json.loads((results / "report.json").read_text())
            original["generated_at"] = "2026-06-01T00:00:00Z"
            (results / "report.json").write_text(json.dumps(original))
            evidence_store.package(results.parent, assets, second)
            one = json.loads(first.read_text())
            two = json.loads(second.read_text())
            self.assertEqual(one["current"], two["current"])
            self.assertEqual(
                one["entries"][one["current"]["test"]]["blob_sha256"],
                two["entries"][two["current"]["test"]]["blob_sha256"],
            )

    def test_merge_prunes_deleted_entries_but_keeps_historical_blobs(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            old_key, keep_key = "a" * 64, "b" * 64
            base = {
                "version": 2,
                "format": "uduck-evidence-v2",
                "entries": {
                    old_key: {"entry": "old", "key": old_key, "asset": "x.tar.gz", "asset_sha256": "c" * 64, "blob_sha256": "c" * 64, "inputs_sha256": "d" * 64},
                    keep_key: {"entry": "keep", "key": keep_key, "asset": "y.tar.gz", "asset_sha256": "e" * 64, "blob_sha256": "e" * 64, "inputs_sha256": "f" * 64},
                },
                "current": {"old": old_key, "keep": keep_key},
            }
            fragment = {"version": 2, "format": "uduck-evidence-v2", "entries": {}, "current": {}}
            (root / "base.json").write_text(json.dumps(base))
            (root / "fragment.json").write_text(json.dumps(fragment))
            with patch.object(evidence_store, "_authored_policies", return_value={"keep": Path("keep.json")}):
                merged = evidence_store.merge(root / "base.json", root / "fragment.json", root / "out.json")
            self.assertNotIn("old", merged["current"])
            self.assertIn("keep", merged["current"])
            self.assertIn(old_key, merged["entries"])

    def test_plan_reuses_only_the_exact_entry_identity_and_artifact(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            policy = root / "registry" / "policies" / "test.json"
            policy.parent.mkdir(parents=True)
            policy.write_text(json.dumps({"id": "test", "source": {"artifact_sha256": "b" * 64}}))
            inputs = "a" * 64
            key = evidence_key(inputs, "b" * 64)
            index = {
                "version": 2,
                "format": "uduck-evidence-v2",
                "entries": {key: {"entry": "test", "inputs_sha256": inputs, "artifact_sha256": "b" * 64}},
                "current": {"test": key},
            }
            (root / "index.json").write_text(json.dumps(index))
            with patch.object(evidence_store, "ROOT", root), \
                 patch.object(evidence_store, "_authored_policies", return_value={"test": policy}), \
                 patch.object(evidence_store, "_policy_inputs", return_value=inputs):
                planned = evidence_store.plan(root / "index.json", root / "plan.json")
            self.assertEqual(planned["items"], [{
                "entry": "test",
                "policy": "registry/policies/test.json",
                "inputs_sha256": inputs,
                "artifact_sha256": "b" * 64,
                "status": "cached",
                "evidence_key": key,
            }])

    def test_archive_is_deterministic_across_wall_clock(self) -> None:
        files = [("test/report.json", b'{"entry":"test","execution":"not-covered"}'), ("test/loop.mp4", b"\x00" * 4096)]
        with patch("time.time", return_value=1700000000.0):
            first = evidence_store._archive_bytes(files)
        with patch("time.time", return_value=1700000005.0):
            second = evidence_store._archive_bytes(files)
        self.assertEqual(first, second)
        self.assertEqual(first[4:8], b"\x00\x00\x00\x00")

    def test_revision_validation_distinguishes_git_sha_from_sha256(self) -> None:
        self.assertTrue(evidence_store.valid_git_revision("a" * 40))
        self.assertFalse(evidence_store.valid_git_revision("a" * 64))
        self.assertTrue(evidence_store.valid_sha256("b" * 64))
        self.assertFalse(evidence_store.valid_sha256("b" * 40))

    def test_archive_rejects_path_traversal(self) -> None:
        archive = evidence_store._archive_bytes([("test/report.json", json.dumps(report()).encode())])
        files = evidence_store._extract_archive(archive, "test", Path("unused"))
        self.assertIn("report.json", files)

        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode="w:gz") as archive_file:
            info = tarfile.TarInfo("../report.json")
            info.size = 2
            archive_file.addfile(info, io.BytesIO(b"{}"))
        with self.assertRaisesRegex(ValueError, "unsafe"):
            evidence_store._extract_archive(stream.getvalue(), "test", Path("unused"))

    def test_workflow_uses_entry_arguments_and_one_plan_index(self) -> None:
        workflow = (Path(__file__).resolve().parents[2] / ".github/workflows/ci.yml").read_text()
        self.assertIn("--entry", workflow)
        self.assertIn("--existing ci-evidence/evidence-index.json", workflow)
        self.assertNotIn("gh release download", workflow)
        self.assertNotIn("release-index/index.json", workflow)
        self.assertNotIn("--behavior", workflow)


if __name__ == "__main__":
    unittest.main()
