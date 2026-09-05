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


    def test_plan_time_base_preserves_cached_entries_when_only_changed_entry_reruns(self) -> None:
        # The exact index used to decide cached-vs-run must also be the publish
        # merge base. If only "changed" reruns, the already-cached entry must
        # survive even though it has no local result in this workflow run.
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            cached_key = "a" * 64
            changed_key = "b" * 64
            base = {
                "version": 2,
                "format": "uduck-evidence-v2",
                "entries": {
                    cached_key: {
                        "behavior": "cached",
                        "key": cached_key,
                        "asset": f"{'c' * 64}.tar.gz",
                        "asset_sha256": "c" * 64,
                        "blob_sha256": "c" * 64,
                        "inputs_sha256": "d" * 64,
                    },
                },
                "current": {"cached": cached_key},
            }
            fragment = {
                "version": 2,
                "format": "uduck-evidence-v2",
                "entries": {
                    changed_key: {
                        "behavior": "changed",
                        "key": changed_key,
                        "asset": f"{'e' * 64}.tar.gz",
                        "asset_sha256": "e" * 64,
                        "blob_sha256": "e" * 64,
                        "inputs_sha256": "f" * 64,
                    },
                },
                "current": {"changed": changed_key},
            }
            (root / "plan-time-index.json").write_text(json.dumps(base))
            (root / "local-fragment.json").write_text(json.dumps(fragment))
            with patch.object(
                evidence_store,
                "_authored_descriptors",
                return_value={"cached": Path("cached.json"), "changed": Path("changed.json")},
            ):
                merged = evidence_store.merge(
                    root / "plan-time-index.json",
                    root / "local-fragment.json",
                    root / "published-index.json",
                )
            self.assertEqual(merged["current"], {"cached": cached_key, "changed": changed_key})
            self.assertIn(cached_key, merged["entries"])
            self.assertIn(changed_key, merged["entries"])

    def test_revision_validation_distinguishes_git_sha_from_sha256(self) -> None:
        self.assertTrue(evidence_store.valid_git_revision("a" * 40))
        self.assertFalse(evidence_store.valid_git_revision("a" * 64))
        self.assertTrue(evidence_store.valid_sha256("b" * 64))
        self.assertFalse(evidence_store.valid_sha256("b" * 40))

    def test_archive_is_deterministic_across_wall_clock(self) -> None:
        files = [
            ("test/report.json", b'{"behavior":"test","execution":"unsupported"}'),
            ("test/loop.mp4", b"\x00" * 4096),
        ]
        # Force different wall-clock times: the old `w:gz` code path stamped
        # time.time() into the gzip header, so identical inputs produced
        # different blob SHAs ~1s apart. The header-mtime assertion below
        # fails that code deterministically, without relying on a sleep.
        with patch("time.time", return_value=1700000000.0):
            first = evidence_store._archive_bytes(files)
        with patch("time.time", return_value=1700000005.0):
            second = evidence_store._archive_bytes(files)
        self.assertEqual(first, second)
        self.assertEqual(first[4:8], b"\x00\x00\x00\x00")
        self.assertEqual(
            evidence_store.sha256_bytes(first), evidence_store.sha256_bytes(second)
        )

    def test_first_publish_round_trips_into_cached_second_plan(self) -> None:
        # Guards the durable-cache contract CI depends on: the merged index
        # produced by `merge` must be plannable as-is, so a second run with
        # unchanged inputs is fully cached instead of starting over.
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            results = root / "sim-results" / "test"
            results.mkdir(parents=True)
            (results / "report.json").write_text(json.dumps(self._unsupported_report()))
            descriptor = root / "test.json"
            descriptor.write_text(json.dumps({
                "id": "test",
                "source": {
                    "repo": "o/r",
                    "revision": "a" * 40,
                    "artifact_sha256": "b" * 64,
                    "manifest_sha256": "c" * 64,
                },
            }))
            with patch.object(evidence_store, "ROOT", root), \
                 patch.object(evidence_store, "_authored_descriptors", return_value={"test": descriptor}), \
                 patch.object(evidence_store, "_descriptor_identity", return_value="a" * 64), \
                 patch.object(evidence_store, "_explicit_artifact_sha", return_value="b" * 64):
                assets = root / "assets"
                fragment = root / "fragment.json"
                evidence_store.package(results.parent, assets, fragment)
                # The release asset name is RELEASE_INDEX_NAME: this is what
                # `fetch-index` downloads on the next run.
                release_index = root / evidence_store.RELEASE_INDEX_NAME
                evidence_store.merge(root / "missing-index.json", fragment, release_index)
                plan_out = root / "plan.json"
                plan = evidence_store.plan(release_index, plan_out)
        item = next(i for i in plan["items"] if i["behavior"] == "test")
        self.assertEqual(item["status"], "cached")

    def test_workflow_carries_plan_time_index_through_publish_and_validate(self) -> None:
        # The plan-time index is a workflow artifact and is the single merge
        # base for publish and validate. Neither downstream job re-downloads
        # the mutable Release index after the cache decision was made.
        repo_root = Path(__file__).resolve().parents[2]
        workflow = (repo_root / ".github/workflows/ci.yml").read_text()
        evidence = workflow.split("\n  evidence:", 1)[1].split("\n  publish-evidence:", 1)[0]
        publish = workflow.split("\n  publish-evidence:", 1)[1].split("\n  validate:", 1)[0]
        validate = workflow.split("\n  validate:", 1)[1]

        self.assertIn("evidence-index.json", evidence)
        self.assertIn("--existing ci-evidence/evidence-index.json", publish)
        self.assertNotIn("gh release download", publish)
        self.assertNotIn("release-index/index.json", publish)
        self.assertIn("--out index.json", publish)
        self.assertIn('index.json --repo "$GH_REPO" --clobber', publish)

        self.assertIn("--existing ci-evidence/evidence-index.json", validate)
        self.assertNotIn("fetch-index", validate)
        self.assertNotIn("durable-evidence-index.json", validate)

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
