"""Content identity for one policy's deterministic execution inputs."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IDENTITY_VERSION = "uduck-execution-inputs-v2"
EVIDENCE_VERSION = "uduck-evidence-v2"
EVIDENCE_ENV = "uduck-evidence-env-v1:ubuntu-24.04:python3.12:mujoco==3.12.0:onnxruntime==1.29.0:numpy==2.5.2:pillow==12.3.0"


def _canonical_value(value):
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, list):
        return [_canonical_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _canonical_value(item) for key, item in value.items()}
    return value


def canonical_json(value) -> bytes:
    return json.dumps(_canonical_value(value), sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _runner_files() -> list[Path]:
    files = [
        ROOT / "simulation/run_check.py",
        ROOT / "simulation/execution.py",
        ROOT / "simulation/fetch_assets.py",
        ROOT / "simulation/http_download.py",
    ]
    files.extend(sorted((ROOT / "simulation/microduck_sim").glob("*.py"), key=lambda path: str(path.relative_to(ROOT))))
    return sorted(files, key=lambda path: str(path.relative_to(ROOT)))


def runner_digest() -> str:
    h = hashlib.sha256()
    for path in _runner_files():
        h.update(str(path.relative_to(ROOT)).encode() + b"\0" + path.read_bytes() + b"\0")
    return h.hexdigest()


def _file_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _execution_manifest(manifest: object) -> dict:
    if not isinstance(manifest, dict):
        return {}
    keys = (
        "schema_version", "model_api", "obs_len", "action_len", "action_scale",
        "kind", "duration_s", "unwind_s", "entry_pose", "command", "robot",
        "decimation", "actuator_model",
    )
    return {key: manifest[key] for key in keys if key in manifest}


def execution_inputs(entry_id: str) -> dict:
    """Return only immutable and execution-relevant state for an entry."""

    policy_path = ROOT / "registry/policies" / f"{entry_id}.json"
    if not policy_path.is_file():
        raise FileNotFoundError(f"authored policy not found: {policy_path}")
    policy = json.loads(policy_path.read_text())
    source = policy["source"]
    generated_path = ROOT / ".generated/policies" / f"{entry_id}.json"
    resolved = json.loads(generated_path.read_text()).get("resolved", {}) if generated_path.is_file() else {}
    simulation = resolved.get("simulation") if isinstance(resolved, dict) else None
    if not isinstance(simulation, dict):
        simulation = {"status": "not-covered", "reason": "Policy resolution is not available."}
    execution = {
        "id": policy.get("id"),
        "source": {
            "provider": source.get("provider"),
            "repo": source.get("repo"),
            "revision": source.get("revision"),
            "artifact_path": source.get("artifact_path"),
            "artifact_sha256": source.get("artifact_sha256"),
            "manifest_path": source.get("manifest_path"),
            "manifest_sha256": source.get("manifest_sha256"),
        },
        "manifest": _execution_manifest(resolved.get("manifest") if isinstance(resolved, dict) else None),
        "simulation": {
            "status": simulation.get("status"),
            "recipe": simulation.get("recipe") if simulation.get("status") == "covered" else None,
            "reason": simulation.get("reason") if simulation.get("status") != "covered" else None,
        },
    }
    return execution


def inputs_digest(entry_id: str) -> str:
    execution = execution_inputs(entry_id)
    h = hashlib.sha256()
    h.update(IDENTITY_VERSION.encode() + b"\0")
    h.update(canonical_json(execution) + b"\0")
    h.update(runner_digest().encode() + b"\0")
    h.update(_file_digest(ROOT / "simulation/assets.lock.json").encode() + b"\0")
    h.update(_file_digest(ROOT / "simulation/requirements.txt").encode() + b"\0")
    h.update(EVIDENCE_ENV.encode())
    return h.hexdigest()


def evidence_key(inputs_sha256: str, artifact_sha256: str) -> str:
    return hashlib.sha256(EVIDENCE_VERSION.encode() + b"\0" + inputs_sha256.encode() + b"\0" + artifact_sha256.encode()).hexdigest()
