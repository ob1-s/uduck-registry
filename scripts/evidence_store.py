#!/usr/bin/env python3
"""Store registry diagnostics in a content-addressed GitHub Release.

The source tree contains authored descriptors and the executable runner. A
simulation result is generated in a temporary CI workspace, then packaged as
one immutable release asset named after its content SHA-256
(``<blob_sha256>.tar.gz``). ``index.json`` is the only mutable release asset:
it maps the current descriptor ids to semantic evidence keys, each of which
points at an immutable blob, and retains older entries for auditability.

This module deliberately uses only the Python standard library. The native
ONNX/MuJoCo runner is used by the evidence job, which has read-only token
permissions. The release and hydration commands do not import or execute a
policy artifact.

Commands:

  package  --results DIR --out DIR --fragment FILE
  merge    --existing FILE --fragment FILE --out FILE
  plan     --index FILE --out FILE
  fetch-index --release-url URL --out FILE
  hydrate  --index FILE --release-url URL --out DIR [--local DIR]

``hydrate`` is used during a build. It copies a matching local result when a
PR build has one, and otherwise downloads the immutable asset for the current
entry from the durable release. It rejects missing, malformed, or stale
assets instead of silently serving an old render.
"""

from __future__ import annotations

import argparse
import copy
import datetime as dt
import hashlib
import io
import json
import re
import sys
import tarfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any, Iterable


ROOT = Path(__file__).resolve().parents[1]
SIMULATION_DIR = ROOT / "simulation"
RESULT_FILE_NAMES = ("report.json", "loop.mp4", "poster.png")
KEY_RE = re.compile(r"^[a-f0-9]{64}$")
REV_RE = re.compile(r"^[a-f0-9]{40}$")
ID_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MAX_ONNX_BYTES = 100 * 1024 * 1024
MAX_EVIDENCE_BYTES = 300 * 1024 * 1024
MAX_REPORT_BYTES = 4 * 1024 * 1024
RELEASE_INDEX_NAME = "index.json"
RELEASE_TAG = "registry-evidence"
FORMAT_VERSION = 2
EVIDENCE_FORMAT = "uduck-evidence-v2"
# Wall-clock fields are useful transiently but must not affect content
# addressing: two runs with identical execution inputs archive identical bytes.
VOLATILE_REPORT_FIELDS = ("generated_at", "observed_at")


def canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def valid_id(value: Any) -> bool:
    return isinstance(value, str) and bool(ID_RE.fullmatch(value))


def valid_key(value: Any) -> bool:
    return isinstance(value, str) and bool(KEY_RE.fullmatch(value))


def valid_sha256(value: Any) -> bool:
    """Validate a 64-hex SHA-256 digest (manifest/artifact/blob)."""
    return isinstance(value, str) and bool(KEY_RE.fullmatch(value))


def valid_git_revision(value: Any) -> bool:
    """Validate a 40-hex Git commit SHA (immutable Hub revision)."""
    return isinstance(value, str) and bool(REV_RE.fullmatch(value))


def empty_index() -> dict[str, Any]:
    return {
        "version": FORMAT_VERSION,
        "format": EVIDENCE_FORMAT,
        "entries": {},
        "current": {},
    }


def read_json(path: Path, default: Any = None) -> Any:
    if not path.is_file():
        return copy.deepcopy(default)
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f"invalid JSON in {path}: {exc}") from exc


def read_index(path: Path) -> dict[str, Any]:
    if not path.is_file():
        return empty_index()
    value = read_json(path)
    if not isinstance(value, dict):
        raise ValueError(f"evidence index must be an object: {path}")
    entries = value.get("entries", {})
    current = value.get("current", {})
    if not isinstance(entries, dict) or not isinstance(current, dict):
        raise ValueError("evidence index entries/current must be objects")
    for key, entry in entries.items():
        if not valid_key(key) or not isinstance(entry, dict):
            raise ValueError(f"invalid evidence index entry: {key!r}")
    for behavior_id, key in current.items():
        if not valid_id(behavior_id) or not valid_key(key):
            raise ValueError(f"invalid current evidence mapping: {behavior_id!r} -> {key!r}")
    result = empty_index()
    result.update(value)
    result["version"] = FORMAT_VERSION
    result["format"] = EVIDENCE_FORMAT
    return result


def _safe_relative_name(name: str) -> str:
    """Return a safe archive member name, rejecting traversal and links."""
    if not name or "\\" in name:
        raise ValueError(f"unsafe evidence archive member: {name!r}")
    path = Path(name)
    if path.is_absolute() or any(part in ("", ".", "..") for part in path.parts):
        raise ValueError(f"unsafe evidence archive member: {name!r}")
    return "/".join(path.parts)


def _safe_release_url(value: str) -> str:
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port or parsed.query or parsed.fragment:
        raise ValueError("release URL must be an https URL without credentials")
    if parsed.hostname != "github.com":
        raise ValueError("release URL must use github.com")
    if not parsed.path.rstrip("/").endswith("/releases/download/" + RELEASE_TAG):
        raise ValueError(f"release URL must end with /releases/download/{RELEASE_TAG}")
    return value.rstrip("/")


def _download(url: str, limit: int) -> bytes:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or parsed.hostname != "github.com":
        raise ValueError("evidence downloads must use https://github.com")
    request = urllib.request.Request(url, headers={"User-Agent": "uduck-registry-evidence"})
    last: Exception | None = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=120) as response:
                chunks: list[bytes] = []
                size = 0
                while True:
                    chunk = response.read(min(1 << 20, limit - size + 1))
                    if not chunk:
                        break
                    chunks.append(chunk)
                    size += len(chunk)
                    if size > limit:
                        raise ValueError(f"download exceeds {limit} bytes: {url}")
                return b"".join(chunks)
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code not in (429, 502, 503, 504) or attempt == 4:
                raise
            retry_after = exc.headers.get("Retry-After", "")
            delay = min(int(retry_after), 60) if retry_after.isdigit() else 2 ** (attempt + 1)
            # CI should not spin on a transient Hub/GitHub response, but a
            # short bounded delay is useful when a release is being uploaded.
            import time
            time.sleep(max(1, delay))
        except (urllib.error.URLError, TimeoutError) as exc:
            last = exc
            if attempt == 4:
                raise
            import time
            time.sleep(2 ** (attempt + 1))
    assert last is not None
    raise last


def _archive_bytes(files: Iterable[tuple[str, bytes]]) -> bytes:
    """Create a deterministic gzip tar archive with regular files only.

    Both layers are pinned: tar members carry ``mtime=0`` and fixed
    ownership/mode, and the gzip wrapper is emitted with ``mtime=0`` and no
    filename header. ``tarfile``'s ``w:gz`` mode would otherwise stamp the
    current wall-clock time into the gzip header, breaking the
    ``same evidence_key -> same blob_sha256`` invariant.
    """
    import gzip

    tar_out = io.BytesIO()
    with tarfile.open(fileobj=tar_out, mode="w") as archive:
        for name, data in sorted(files):
            safe_name = _safe_relative_name(name)
            info = tarfile.TarInfo(safe_name)
            info.size = len(data)
            info.mode = 0o644
            info.mtime = 0
            info.uid = 0
            info.gid = 0
            info.uname = ""
            info.gname = ""
            archive.addfile(info, io.BytesIO(data))
    return gzip.compress(tar_out.getvalue(), compresslevel=9, mtime=0)


def _result_dirs(results: Path) -> list[Path]:
    if not results.is_dir():
        raise ValueError(f"result directory does not exist: {results}")
    return sorted({report.parent for report in results.rglob("report.json")})


def _policy_sha(report: dict[str, Any]) -> str | None:
    policy = report.get("policy")
    if isinstance(policy, dict):
        for key in ("sha256", "artifact_sha256"):
            value = policy.get(key)
            if valid_key(value):
                return value
    for key in ("artifact_sha256", "policy_sha256"):
        value = report.get(key)
        if valid_key(value):
            return value
    return None


def _report_key(report: dict[str, Any]) -> tuple[str, str]:
    key = report.get("evidence_key")
    if valid_key(key):
        return key, "runner"
    identity = report.get("inputs_sha256")
    artifact = _policy_sha(report)
    if valid_key(identity) and valid_key(artifact):
        # Keep the key algorithm owned by the runner. Import lazily so this
        # publisher remains usable in a minimal Python job.
        sys.path.insert(0, str(SIMULATION_DIR))
        from evidence import evidence_key  # type: ignore
        return evidence_key(identity, artifact), "derived"

    # Unsupported/rejected reports from older runners did not carry identity
    # fields. They can still be made visible in the release, but are marked as
    # fallback identities and are never treated as a cache hit by ``plan``.
    stable = {k: v for k, v in report.items() if k != "generated_at"}
    return sha256_bytes(b"uduck-report-v1\0" + canonical_json(stable)), "report-fallback"


def _authored_descriptors() -> dict[str, Path]:
    """Return the one descriptor source for every current catalog id."""
    result: dict[str, Path] = {}
    for directory in (ROOT / "registry" / "behaviors", ROOT / "registry" / "policies"):
        if not directory.is_dir():
            continue
        for path in sorted(directory.glob("*.json")):
            value = read_json(path)
            behavior_id = value.get("id") if isinstance(value, dict) else None
            if not valid_id(behavior_id) or path.stem != behavior_id:
                raise ValueError(f"descriptor filename/id mismatch: {path}")
            if behavior_id in result:
                raise ValueError(f"duplicate authored descriptor id: {behavior_id}")
            result[behavior_id] = path
    return result


def _descriptor_identity(path: Path, behavior_id: str) -> str:
    """Use the exact identity implementation used by ``run_check``.

    There is intentionally no generic fallback. If a new descriptor class is
    introduced, its runner must teach ``simulation.evidence.inputs_digest`` how
    to represent it before evidence can be cached or hydrated.
    """
    sys.path.insert(0, str(SIMULATION_DIR))
    try:
        from evidence import inputs_digest  # type: ignore
    except ImportError as exc:
        raise ValueError("simulation.evidence.inputs_digest is unavailable") from exc
    try:
        return inputs_digest(behavior_id)
    except Exception as exc:  # noqa: BLE001
        raise ValueError(f"unable to compute canonical evidence identity for {behavior_id}: {exc}") from exc


def _validate_report(report: Any, path: Path) -> dict[str, Any]:
    if not isinstance(report, dict):
        raise ValueError(f"report must be an object: {path}")
    behavior_id = report.get("behavior")
    if not valid_id(behavior_id):
        raise ValueError(f"report has an unsafe behavior id: {path}")
    execution = report.get("execution")
    if execution not in ("rendered", "unsupported", "rejected", "failed"):
        raise ValueError(f"report has unsupported execution status {execution!r}: {path}")
    return report


def _explicit_artifact_sha(descriptor: dict[str, Any]) -> str | None:
    candidates: list[Any] = [descriptor]
    for key in ("source", "resolved"):
        child = descriptor.get(key)
        if isinstance(child, dict):
            candidates.append(child)
            source = child.get("source")
            if isinstance(source, dict):
                candidates.append(source)
    for candidate in candidates:
        for key in ("artifact_sha256", "policy_sha256"):
            value = candidate.get(key) if isinstance(candidate, dict) else None
            if valid_key(value):
                return value
    return None


def _artifact_url(descriptor: dict[str, Any]) -> str | None:
    onnx = descriptor.get("artifacts", {}).get("onnx") if isinstance(descriptor.get("artifacts"), dict) else None
    if isinstance(onnx, dict) and isinstance(onnx.get("url"), str):
        return onnx["url"]
    source = descriptor.get("source")
    if isinstance(source, dict) and isinstance(source.get("repo"), str) and valid_git_revision(source.get("revision")):
        return f"https://huggingface.co/{source['repo']}/resolve/{source['revision']}/policy.onnx"
    resolved = descriptor.get("resolved")
    if isinstance(resolved, dict):
        return _artifact_url(resolved)
    return None


def normalize_report_for_archive(report: dict[str, Any]) -> dict[str, Any]:
    """Return the immutable archived report without volatile timestamps."""
    return {k: v for k, v in report.items() if k not in VOLATILE_REPORT_FIELDS}


def _augment_report_identity(report: dict[str, Any]) -> dict[str, Any]:
    """Fill identity fields for old unsupported/rejected runner reports."""
    behavior_id = report["behavior"]
    descriptor_path = _authored_descriptors().get(behavior_id)
    if descriptor_path is None:
        return report
    descriptor = read_json(descriptor_path)
    if not isinstance(descriptor, dict):
        return report
    inputs_sha = _descriptor_identity(descriptor_path, behavior_id)
    existing_inputs = report.get("inputs_sha256")
    if existing_inputs is not None and existing_inputs != inputs_sha:
        raise ValueError(f"report input identity does not match current descriptor: {behavior_id}")
    report["inputs_sha256"] = inputs_sha

    artifact_sha = _policy_sha(report) or _explicit_artifact_sha(descriptor)
    if artifact_sha:
        policy = report.setdefault("policy", {})
        if not isinstance(policy, dict):
            raise ValueError(f"report policy field is not an object: {behavior_id}")
        existing_artifact = _policy_sha(report)
        if existing_artifact is not None and existing_artifact != artifact_sha:
            raise ValueError(f"report artifact identity does not match current descriptor: {behavior_id}")
        policy["sha256"] = artifact_sha
        expected_key = None
        sys.path.insert(0, str(SIMULATION_DIR))
        try:
            from evidence import evidence_key  # type: ignore
            expected_key = evidence_key(inputs_sha, artifact_sha)
        except ImportError:
            expected_key = None
        if expected_key is not None:
            current_key = report.get("evidence_key")
            if current_key is not None and current_key != expected_key:
                raise ValueError(f"report evidence key does not match current inputs: {behavior_id}")
            report["evidence_key"] = expected_key
    return report


def normalize_report_identity(report: dict[str, Any]) -> dict[str, Any]:
    """Canonical identity path used by package, local discovery, and hydration.

    Every evidence-key computation must go through here so a new unsupported
    pointer on a PR produces the same key in its temporary index and in the
    local-results map. Without this, hydrate cannot find the local result and
    tries to download an unpublished Release asset.
    """
    validated = _validate_report(report, Path(f"report:{report.get('behavior', '?')}"))
    return _augment_report_identity(validated)


def package(results: Path, out: Path, fragment: Path) -> dict[str, Any]:
    """Package every result report and emit a mergeable index fragment."""
    out.mkdir(parents=True, exist_ok=True)
    entries: dict[str, dict[str, Any]] = {}
    current: dict[str, str] = {}

    for result_dir in _result_dirs(results):
        report_path = result_dir / "report.json"
        if report_path.stat().st_size > MAX_REPORT_BYTES:
            raise ValueError(f"report exceeds {MAX_REPORT_BYTES} bytes: {report_path}")
        report = normalize_report_identity(read_json(report_path))
        behavior_id = report["behavior"]
        key, identity_source = _report_key(report)
        # Archive the normalized report so wall-clock timestamps do not break
        # content addressing. Observation/upload time lives in index metadata.
        normalized = normalize_report_for_archive(report)
        files: list[tuple[str, bytes]] = [(f"{behavior_id}/report.json", canonical_json(normalized) + b"\n")]
        present: list[str] = []
        for filename in ("loop.mp4", "poster.png"):
            source = result_dir / filename
            if source.is_file():
                data = source.read_bytes()
                if len(data) > MAX_EVIDENCE_BYTES:
                    raise ValueError(f"evidence file exceeds size limit: {source}")
                files.append((f"{behavior_id}/{filename}", data))
                present.append(filename)

        if report["execution"] == "rendered" and set(present) != {"loop.mp4", "poster.png"}:
            raise ValueError(f"rendered report is missing loop.mp4 or poster.png: {result_dir}")
        if report["execution"] in ("unsupported", "rejected", "failed") and present not in ([], ["loop.mp4", "poster.png"]):
            # Report-only evidence is legitimate; partial media is not.
            if present:
                raise ValueError(f"non-rendered report must not carry partial media: {result_dir}")

        archive = _archive_bytes(files)
        blob_sha = sha256_bytes(archive)
        asset_name = f"{blob_sha}.tar.gz"
        destination = out / asset_name
        if destination.exists() and destination.read_bytes() != archive:
            # Same blob name must mean same bytes; different bytes under the
            # same blob name would be a store corruption.
            raise ValueError(f"immutable blob {asset_name} already exists with different bytes")
        destination.write_bytes(archive)

        artifact_sha = _policy_sha(report)
        entry = {
            "behavior": behavior_id,
            "key": key,
            "asset": asset_name,
            "asset_sha256": blob_sha,
            "blob_sha256": blob_sha,
            "asset_bytes": len(archive),
            "execution": report["execution"],
            "identity_source": identity_source,
            "inputs_sha256": report.get("inputs_sha256"),
            "artifact_sha256": artifact_sha,
            "checks_status": report.get("checks_status"),
            "reason": report.get("reason"),
            "observed_at": report.get("generated_at"),
        }
        previous = entries.get(key)
        if previous is not None:
            if previous.get("blob_sha256") != blob_sha or previous.get("asset") != asset_name:
                raise ValueError(
                    f"evidence key {key} maps to conflicting immutable content: "
                    f"{previous.get('asset')} vs {asset_name}. Same semantic inputs produced different bytes; "
                    "this is expected media nondeterminism or a broken identity boundary, not a silent overwrite."
                )
            # Same semantic key and same normalized blob is idempotent: keep
            # the first observation time, ignore wall-clock reruns.
            continue
        entries[key] = entry
        current[behavior_id] = key

    fragment_value = {
        "version": FORMAT_VERSION,
        "format": EVIDENCE_FORMAT,
        "entries": entries,
        "current": current,
    }
    fragment.parent.mkdir(parents=True, exist_ok=True)
    fragment.write_text(json.dumps(fragment_value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return fragment_value


def merge(existing: Path, fragment: Path, out: Path) -> dict[str, Any]:
    base = read_index(existing)
    addition = read_index(fragment)
    entries = base.setdefault("entries", {})
    current = base.setdefault("current", {})
    for key, entry in addition["entries"].items():
        if key in entries:
            prev = entries[key]
            # Immutable semantic key: same key must map to same blob bytes.
            # observed_at is index metadata and is allowed to differ; any
            # other difference is a broken identity boundary.
            prev_cmp = {k: v for k, v in prev.items() if k not in ("observed_at", "generated_at", "updated_at")}
            new_cmp = {k: v for k, v in entry.items() if k not in ("observed_at", "generated_at", "updated_at")}
            if prev_cmp != new_cmp:
                raise ValueError(f"existing evidence key has different immutable content: {key}")
            # Idempotent rerun: keep the earliest observation.
            continue
        entries[key] = entry
    current.update(addition["current"])
    # Prune deleted IDs from current while retaining historical blobs in
    # entries for audit. The evidence plan knows the entire desired catalog.
    try:
        authored_ids = set(_authored_descriptors())
    except Exception:
        authored_ids = set(current)
    for stale_id in [bid for bid in current if bid not in authored_ids]:
        del current[stale_id]
    base["updated_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(base, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return base


def _descriptor_files() -> list[Path]:
    return list(_authored_descriptors().values())


def _descriptor_inputs(path: Path, behavior_id: str) -> str:
    if path not in _authored_descriptors().values():
        raise ValueError(f"descriptor is not an authored registry input: {path}")
    return _descriptor_identity(path, behavior_id)


def _hash_artifact(url: str) -> str:
    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.hostname not in ("huggingface.co", "raw.githubusercontent.com"):
        raise ValueError(f"artifact host is not allowed: {url}")
    request = urllib.request.Request(url, headers={"User-Agent": "uduck-registry-evidence"})
    # This uses the same bounded retry behavior as the simulation runner when
    # available, while keeping planning independent from MuJoCo imports.
    try:
        sys.path.insert(0, str(SIMULATION_DIR))
        from http_download import open_download  # type: ignore
        response = open_download(request, timeout=300)
    except ImportError:
        response = urllib.request.urlopen(request, timeout=300)
    with response:
        digest = hashlib.sha256()
        size = 0
        while True:
            chunk = response.read(1 << 20)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_ONNX_BYTES:
                raise ValueError("ONNX artifact exceeds 100 MB sanity bound")
            digest.update(chunk)
        return digest.hexdigest()


def plan(index_path: Path, out: Path) -> dict[str, Any]:
    """Plan expensive simulations, reusing a release result when safe.

    A missing index deliberately means ``run`` for every descriptor. On a main
    build with an index, descriptors are first compared by runner input
    identity. For a legacy descriptor without an authored artifact hash, the
    immutable byte hash is downloaded only when that identity is otherwise a
    candidate for reuse.
    """
    index = read_index(index_path)
    current = index.get("current", {})
    entries = index.get("entries", {})
    items: list[dict[str, Any]] = []
    for path in _descriptor_files():
        descriptor = read_json(path)
        if not isinstance(descriptor, dict):
            continue
        behavior_id = descriptor.get("id")
        if not valid_id(behavior_id):
            continue
        inputs_sha = _descriptor_inputs(path, behavior_id)
        previous_key = current.get(behavior_id)
        previous = entries.get(previous_key) if valid_key(previous_key) else None
        item: dict[str, Any] = {
            "behavior": behavior_id,
            "descriptor": str(path.relative_to(ROOT)),
            "inputs_sha256": inputs_sha,
            "status": "run",
        }
        if isinstance(previous, dict) and previous.get("inputs_sha256") == inputs_sha and valid_key(previous_key):
            artifact_sha = _explicit_artifact_sha(descriptor)
            if artifact_sha is None:
                url = _artifact_url(descriptor)
                if url:
                    try:
                        artifact_sha = _hash_artifact(url)
                    except Exception as exc:  # noqa: BLE001
                        # A transient upstream failure must never turn a
                        # missing verification into a cache hit. Re-run the
                        # trusted diagnostic, which will report the actual
                        # download failure if the source remains unavailable.
                        print(f"[{behavior_id}] unable to verify cached artifact; scheduling a fresh run: {exc}", file=sys.stderr)
            if artifact_sha and previous.get("artifact_sha256") == artifact_sha:
                item.update({"status": "cached", "evidence_key": previous_key, "artifact_sha256": artifact_sha})
        items.append(item)

    value = {"version": FORMAT_VERSION, "format": "uduck-evidence-plan-v1", "items": items}
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return value


def fetch_index(release_url: str, out: Path, allow_missing: bool) -> dict[str, Any]:
    base = _safe_release_url(release_url)
    out.parent.mkdir(parents=True, exist_ok=True)
    try:
        data = _download(f"{base}/{RELEASE_INDEX_NAME}", MAX_REPORT_BYTES)
        value = json.loads(data)
        if not isinstance(value, dict):
            raise ValueError("release evidence index must be an object")
        # Validate before writing it into a build workspace.
        temp = out.with_suffix(out.suffix + ".check")
        temp.write_bytes(data)
        read_index(temp)
        temp.unlink(missing_ok=True)
    except urllib.error.HTTPError as exc:
        if not allow_missing or exc.code != 404:
            raise
        value = empty_index()
    out.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    return value


def _local_results(local: Path | None) -> dict[str, Path]:
    if local is None or not local.is_dir():
        return {}
    result: dict[str, Path] = {}
    for report_path in sorted(local.rglob("report.json")):
        report = normalize_report_identity(read_json(report_path))
        key, _ = _report_key(report)
        if key in result:
            raise ValueError(f"duplicate local evidence key {key}")
        result[key] = report_path.parent
    return result


def _extract_archive(data: bytes, behavior_id: str, out: Path) -> dict[str, bytes]:
    if len(data) > MAX_EVIDENCE_BYTES:
        raise ValueError("evidence release asset exceeds size limit")
    files: dict[str, bytes] = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode="r:gz") as archive:
        for member in archive.getmembers():
            name = _safe_relative_name(member.name)
            if not member.isfile() or member.issym() or member.islnk():
                raise ValueError(f"evidence archive contains a non-regular member: {member.name}")
            expected_prefix = behavior_id + "/"
            if not name.startswith(expected_prefix):
                raise ValueError(f"evidence archive member is for a different behavior: {member.name}")
            filename = name[len(expected_prefix):]
            if filename not in RESULT_FILE_NAMES:
                raise ValueError(f"unexpected evidence archive member: {member.name}")
            stream = archive.extractfile(member)
            if stream is None:
                raise ValueError(f"unable to read evidence archive member: {member.name}")
            content = stream.read(MAX_EVIDENCE_BYTES + 1)
            if len(content) > MAX_EVIDENCE_BYTES:
                raise ValueError(f"evidence archive member exceeds size limit: {member.name}")
            files[filename] = content
    if "report.json" not in files:
        raise ValueError("evidence archive has no report.json")
    return files


def _write_result(
    files: dict[str, bytes],
    behavior_id: str,
    out: Path,
    expected_key: str,
    expected_inputs: str | None = None,
    expected_artifact: str | None = None,
) -> None:
    report = normalize_report_identity(json.loads(files["report.json"]))
    actual_key, _ = _report_key(report)
    if report.get("evidence_key") != expected_key and actual_key != expected_key:
        raise ValueError(f"evidence report key mismatch for {behavior_id}")
    if report.get("behavior") != behavior_id:
        raise ValueError(f"evidence report behavior mismatch for {behavior_id}")
    if expected_inputs is not None and report.get("inputs_sha256") != expected_inputs:
        raise ValueError(f"stale evidence identity for {behavior_id}")
    if expected_artifact is not None:
        actual_artifact = _policy_sha(report)
        if actual_artifact is not None and actual_artifact != expected_artifact:
            raise ValueError(f"evidence artifact mismatch for {behavior_id}")
    execution = report.get("execution")
    if execution == "rendered":
        if "loop.mp4" not in files or "poster.png" not in files:
            raise ValueError(f"rendered result is missing loop/poster for {behavior_id}")
    elif execution in ("unsupported", "rejected", "failed"):
        # Report-only evidence is legitimate; partial media is not.
        if ("loop.mp4" in files) != ("poster.png" in files):
            raise ValueError(f"non-rendered result has partial media for {behavior_id}")
    else:
        raise ValueError(f"unsupported execution status for {behavior_id}: {execution!r}")
    destination = out / behavior_id
    # No stale generated files survive from a previous hydration.
    if destination.exists():
        for stale in sorted(destination.iterdir()):
            if stale.is_file() or stale.is_symlink():
                stale.unlink()
            elif stale.is_dir():
                import shutil
                shutil.rmtree(stale)
    destination.mkdir(parents=True, exist_ok=True)
    for filename, content in files.items():
        if filename not in RESULT_FILE_NAMES:
            raise ValueError(f"unexpected result file for {behavior_id}: {filename}")
        (destination / filename).write_bytes(content)
    # The report's paths are generated in a disposable runner workspace. The
    # site consumes stable build paths instead. Reattach the index observation
    # time in a controlled way; the archived report itself has no wall clock.
    report["evidence_key"] = expected_key
    if "loop.mp4" in files and "poster.png" in files:
        report["media"] = {
            "loop_url": f"/media/registry-sim/{behavior_id}/loop.mp4",
            "poster_url": f"/media/registry-sim/{behavior_id}/poster.png",
        }
    (destination / "report.json").write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def hydrate(index_path: Path, release_url: str, out: Path, local: Path | None, behavior_ids: list[str]) -> dict[str, Any]:
    index = read_index(index_path)
    base = _safe_release_url(release_url)
    local_map = _local_results(local)
    current: dict[str, str] = index.get("current", {})
    authored = _authored_descriptors()
    requested = set(behavior_ids) if behavior_ids else set(authored)
    unknown_authored = requested - set(authored)
    if unknown_authored:
        raise ValueError("no authored descriptor for: " + ", ".join(sorted(unknown_authored)))
    unknown = requested - set(current)
    if unknown:
        raise ValueError("evidence index has no current entries for: " + ", ".join(sorted(unknown)))
    hydrated: list[dict[str, str]] = []
    # Clear the generated target before hydration so stale files cannot survive.
    out.mkdir(parents=True, exist_ok=True)
    for behavior_id in sorted(requested):
        if not valid_id(behavior_id):
            raise ValueError(f"invalid requested behavior id: {behavior_id!r}")
        key = current[behavior_id]
        entry = index["entries"].get(key)
        if not isinstance(entry, dict) or entry.get("behavior") != behavior_id:
            raise ValueError(f"evidence index entry is missing or mismatched for {behavior_id}")
        expected_inputs = _descriptor_identity(authored[behavior_id], behavior_id)
        if entry.get("inputs_sha256") != expected_inputs:
            raise ValueError(f"stale evidence identity for {behavior_id}")
        expected_artifact = entry.get("artifact_sha256")
        if expected_artifact is not None and not valid_sha256(expected_artifact):
            raise ValueError(f"invalid artifact hash in index for {behavior_id}")
        # Authored pointer identity must still match where explicitly known.
        try:
            authored_doc = read_json(authored[behavior_id])
            if isinstance(authored_doc, dict):
                explicit = _explicit_artifact_sha(authored_doc)
                if explicit is not None and expected_artifact is not None and explicit != expected_artifact:
                    raise ValueError(f"index artifact does not match authored pointer for {behavior_id}")
        except ValueError:
            raise
        except Exception:
            pass
        source = local_map.get(key)
        if source is not None:
            files: dict[str, bytes] = {}
            for filename in RESULT_FILE_NAMES:
                path = source / filename
                if path.is_file():
                    if path.stat().st_size > MAX_EVIDENCE_BYTES:
                        raise ValueError(f"local result exceeds size limit: {path}")
                    files[filename] = path.read_bytes()
            if "report.json" not in files:
                raise ValueError(f"local result has no report for {behavior_id}")
            _write_result(files, behavior_id, out, key, expected_inputs, expected_artifact)
            hydrated.append({"behavior": behavior_id, "key": key, "source": "local"})
            continue
        asset = entry.get("asset")
        blob_sha = entry.get("blob_sha256") or entry.get("asset_sha256")
        # Prefer blob-identity filenames; accept legacy key-named assets when
        # the blob hash matches, so a partially migrated Release still hydrates.
        if not isinstance(asset, str) or not asset.endswith(".tar.gz"):
            raise ValueError(f"invalid release asset name for {behavior_id}")
        if blob_sha is not None and asset != f"{blob_sha}.tar.gz" and asset != f"{key}.tar.gz":
            raise ValueError(f"invalid release asset name for {behavior_id}: {asset}")
        data = _download(f"{base}/{asset}", MAX_EVIDENCE_BYTES)
        expected_asset_sha = entry.get("asset_sha256") or blob_sha
        if not valid_sha256(expected_asset_sha) or sha256_bytes(data) != expected_asset_sha:
            raise ValueError(f"evidence asset hash mismatch for {behavior_id}")
        files = _extract_archive(data, behavior_id, out)
        _write_result(files, behavior_id, out, key, expected_inputs, expected_artifact)
        hydrated.append({"behavior": behavior_id, "key": key, "source": "release"})
    return {"version": FORMAT_VERSION, "hydrated": hydrated}


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)

    package_parser = sub.add_parser("package")
    package_parser.add_argument("--results", type=Path, required=True)
    package_parser.add_argument("--out", type=Path, required=True)
    package_parser.add_argument("--fragment", type=Path, required=True)

    merge_parser = sub.add_parser("merge")
    merge_parser.add_argument("--existing", type=Path, required=True)
    merge_parser.add_argument("--fragment", type=Path, required=True)
    merge_parser.add_argument("--out", type=Path, required=True)

    plan_parser = sub.add_parser("plan")
    plan_parser.add_argument("--index", type=Path, required=True)
    plan_parser.add_argument("--out", type=Path, required=True)

    fetch_parser = sub.add_parser("fetch-index")
    fetch_parser.add_argument("--release-url", required=True)
    fetch_parser.add_argument("--out", type=Path, required=True)
    fetch_parser.add_argument("--allow-missing", action="store_true")

    hydrate_parser = sub.add_parser("hydrate")
    hydrate_parser.add_argument("--index", type=Path, required=True)
    hydrate_parser.add_argument("--release-url", required=True)
    hydrate_parser.add_argument("--out", type=Path, required=True)
    hydrate_parser.add_argument("--local", type=Path)
    hydrate_parser.add_argument("--behavior", action="append", default=[])

    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "package":
            package(args.results, args.out, args.fragment)
        elif args.command == "merge":
            merge(args.existing, args.fragment, args.out)
        elif args.command == "plan":
            plan(args.index, args.out)
        elif args.command == "fetch-index":
            fetch_index(args.release_url, args.out, args.allow_missing)
        elif args.command == "hydrate":
            hydrate(args.index, args.release_url, args.out, args.local, args.behavior)
        else:
            raise ValueError(f"unknown command {args.command}")
    except Exception as exc:  # noqa: BLE001
        print(f"evidence store: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
