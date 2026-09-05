"""Content identity for diagnostic execution inputs, independent of timestamps.

Version 2 (uduck-execution-inputs-v2): only execution-relevant authored state
participates. A category/tag/summary change must not consume simulator time.
Mutable display names are not baked into renders (the runner captions by entry
ID), so they are excluded here. Runner code, asset lock, dependency pins, and
an explicit environment contract are all part of the identity.
"""
import hashlib
import json
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent

IDENTITY_VERSION = "uduck-execution-inputs-v2"
EVIDENCE_VERSION = "uduck-evidence-v2"
# Bump when CI/runtime assumptions change (runner family, Python, system deps).
# Python packages themselves are pinned in simulation/requirements.txt and are
# hashed separately; this constant covers the surrounding environment.
EVIDENCE_ENV = (
    "uduck-evidence-env-v1"
    ":ubuntu-24.04"
    ":python3.12"
    ":mujoco==3.12.0"
    ":onnxruntime==1.29.0"
    ":numpy==2.5.2"
    ":pillow==12.3.0"
)


def canonical_json(value) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _runner_files():
    files = sorted(
        (p for p in (ROOT / "simulation").rglob("*.py") if "tests" not in p.parts),
        key=lambda p: str(p.relative_to(ROOT)),
    )
    files = [*files, ROOT / "simulation/assets.lock.json", ROOT / "simulation/requirements.txt"]
    return sorted(files, key=lambda p: str(p.relative_to(ROOT)))


def runner_digest() -> str:
    h = hashlib.sha256()
    for p in _runner_files():
        h.update(str(p.relative_to(ROOT)).encode() + b"\0" + p.read_bytes() + b"\0")
    return h.hexdigest()


def _file_digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def execution_descriptor(behavior_id: str) -> dict:
    """Return only execution-relevant authored state for an entry."""
    policy_path = ROOT / "registry/policies" / f"{behavior_id}.json"
    behavior_path = ROOT / "registry/behaviors" / f"{behavior_id}.json"
    if policy_path.is_file():
        data = json.loads(policy_path.read_text())
        source = data.get("source", {}) if isinstance(data, dict) else {}
        return {
            "kind": "policy",
            "id": data.get("id"),
            "repo": source.get("repo"),
            "revision": source.get("revision"),
            "manifest_sha256": source.get("manifest_sha256"),
            "artifact_sha256": source.get("artifact_sha256"),
        }
    data = json.loads(behavior_path.read_text())
    contract = data.get("contract", {}) if isinstance(data, dict) else {}
    compatibility = data.get("compatibility", {}) if isinstance(data, dict) else {}
    simulation = data.get("simulation") if isinstance(data, dict) else None
    artifacts = data.get("artifacts", {}) if isinstance(data, dict) else {}
    onnx = artifacts.get("onnx", {}) if isinstance(artifacts, dict) else {}
    return {
        "kind": "manual",
        "id": data.get("id"),
        "contract": {
            "observation_dim": contract.get("observation_dim"),
            "action_dim": contract.get("action_dim"),
            "control_frequency_hz": contract.get("control_frequency_hz"),
            "decimation": contract.get("decimation"),
            "actuator_model": contract.get("actuator_model"),
            "action_scale": contract.get("action_scale"),
        },
        "compatibility": {
            "robot_model": compatibility.get("robot_model"),
        },
        "simulation": simulation,
        "artifact_url": onnx.get("url"),
    }


def inputs_digest(behavior_id):
    execution = execution_descriptor(behavior_id)
    h = hashlib.sha256()
    h.update(IDENTITY_VERSION.encode() + b"\0")
    h.update(canonical_json(execution) + b"\0")
    h.update(runner_digest().encode() + b"\0")
    h.update(_file_digest(ROOT / "simulation/assets.lock.json").encode() + b"\0")
    h.update(_file_digest(ROOT / "simulation/requirements.txt").encode() + b"\0")
    h.update(EVIDENCE_ENV.encode())
    return h.hexdigest()


def evidence_key(inputs_sha256, artifact_sha256):
    return hashlib.sha256(
        EVIDENCE_VERSION.encode() + b"\0"
        + inputs_sha256.encode() + b"\0"
        + artifact_sha256.encode()
    ).hexdigest()
