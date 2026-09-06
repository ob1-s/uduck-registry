#!/usr/bin/env python3
"""Resolve immutable upstream policy artifacts without executing publisher code."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from simulation.execution_recipes import recipe_for_policy, recipe_reason

SHA = re.compile(r"^[0-9a-f]{40}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
REPO = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]*/[A-Za-z0-9][A-Za-z0-9_.-]*$")
PATH = re.compile(r"^(?!/)(?!.*(?:^|/)\.\.?(?:/|$))[A-Za-z0-9._-]+(?:/[A-Za-z0-9._-]+)*$")
CATEGORIES = {"locomotion", "agility-tricks", "manipulation", "recovery", "roller-skate", "experimental"}
PROVIDERS = {"github", "huggingface-model", "huggingface-space"}
SUPPORTED_SERVO_DECLARATIONS = {"xl330", "14x dynamixel xl330"}


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


class SafeRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        parsed = urllib.parse.urlsplit(newurl)
        allowed = parsed.hostname == "huggingface.co" or parsed.hostname == "raw.githubusercontent.com" or (parsed.hostname or "").endswith((".huggingface.co", ".hf.co", ".xethub.hf.co"))
        if parsed.scheme != "https" or parsed.username or parsed.password or not allowed:
            raise ValueError("upstream redirected to an unsupported host")
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def fetch(url: str, limit: int = 2 * 1024 * 1024) -> bytes:
    """Fetch bounded upstream bytes with retries for transient responses."""

    parsed = urllib.parse.urlsplit(url)
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.hostname not in {"huggingface.co", "api.github.com", "github.com", "raw.githubusercontent.com"}:
        raise ValueError(f"unsupported upstream URL: {url}")
    import time
    last: Exception | None = None
    for attempt in range(5):
        try:
            opener = urllib.request.build_opener(SafeRedirect())
            request = urllib.request.Request(url, headers={"User-Agent": "uduck-registry"})
            with opener.open(request, timeout=120) as response:
                data = response.read(limit + 1)
            if len(data) > limit:
                raise ValueError(f"download exceeds {limit} bytes")
            return data
        except urllib.error.HTTPError as exc:
            last = exc
            if exc.code not in (429, 502, 503, 504) or attempt == 4:
                raise
            retry_after = exc.headers.get("Retry-After", "")
            delay = min(int(retry_after), 60) if retry_after.isdigit() else 2 ** (attempt + 1)
            time.sleep(max(1, delay))
        except (urllib.error.URLError, TimeoutError) as exc:
            last = exc
            if attempt == 4:
                raise
            time.sleep(2 ** (attempt + 1))
    assert last is not None
    raise last


def parse_source_url(value: str) -> tuple[str, str, str]:
    parsed = urllib.parse.urlsplit(value)
    if parsed.scheme != "https" or parsed.username or parsed.password or parsed.port or parsed.query or parsed.fragment:
        raise ValueError("source URL must be an https URL without query or fragment")
    parts = parsed.path.strip("/").split("/")
    if parsed.hostname == "huggingface.co":
        if len(parts) >= 3 and parts[0] == "spaces":
            provider, repo_parts = "huggingface-space", parts[1:3]
            offset = 3
        else:
            if parts and parts[0] in {"datasets", "spaces"}:
                raise ValueError("expected a Hugging Face model repository URL")
            provider, repo_parts = "huggingface-model", parts[:2]
            offset = 2
        if len(repo_parts) != 2 or not REPO.fullmatch("/".join(repo_parts)):
            raise ValueError("expected a Hugging Face owner/repository URL")
        revision = "main"
        if len(parts) > offset:
            if len(parts) != offset + 2 or parts[offset] != "tree" or not re.fullmatch(r"[A-Za-z0-9_.-]+", parts[offset + 1]):
                raise ValueError("source URL may optionally include /tree/<revision>")
            revision = parts[offset + 1]
        return provider, "/".join(repo_parts), revision
    if parsed.hostname == "github.com":
        if len(parts) < 2 or not REPO.fullmatch("/".join(parts[:2])):
            raise ValueError("expected a GitHub owner/repository URL")
        revision = "main"
        if len(parts) > 2:
            if len(parts) != 4 or parts[2] != "tree" or not re.fullmatch(r"[A-Za-z0-9_.-]+", parts[3]):
                raise ValueError("GitHub source URL may optionally include /tree/<revision>")
            revision = parts[3]
        return "github", "/".join(parts[:2]), revision
    raise ValueError("source URL host must be huggingface.co or github.com")


def parse_url(value: str) -> tuple[str, str]:
    """Parse a model URL for contributor tooling that only needs repo/revision."""

    provider, repo, revision = parse_source_url(value)
    if provider != "huggingface-model":
        raise ValueError("this contributor command accepts Hugging Face model URLs")
    return repo, revision


def source_artifact_url(source: dict) -> str:
    provider, repo, revision, artifact_path = source["provider"], source["repo"], source["revision"], source["artifact_path"]
    if provider == "github":
        return f"https://raw.githubusercontent.com/{repo}/{revision}/{artifact_path}"
    prefix = "spaces/" if provider == "huggingface-space" else ""
    return f"https://huggingface.co/{prefix}{repo}/resolve/{revision}/{artifact_path}"


def source_file_url(source: dict, relative_path: str) -> str:
    if source["provider"] == "github":
        return f"https://raw.githubusercontent.com/{source['repo']}/{source['revision']}/{relative_path}"
    prefix = "spaces/" if source["provider"] == "huggingface-space" else ""
    return f"https://huggingface.co/{prefix}{source['repo']}/resolve/{source['revision']}/{relative_path}"


def _manifest_diagnosis(manifest: dict, repo: str, source: dict) -> dict:
    """Classify only explicit package metadata; missing facts stay unresolved."""

    if not isinstance(manifest, dict) or manifest.get("schema_version") not in (2, 3):
        raise ValueError("expected policy manifest schema_version 2 or 3")
    if "policies" in manifest:
        raise ValueError("multi-policy sets require separate authored entries")
    issues: list[str] = []
    for key, expected in (("obs_len", 61), ("action_len", 14), ("model_api", 1)):
        value = manifest.get(key)
        if value is None:
            issues.append(f"{key} is not declared")
        elif type(value) is not int or value != expected:
            raise ValueError(f"unsupported {key}: {value!r} (registry supports {expected})")
    robot = manifest.get("robot", {})
    if not isinstance(robot, dict):
        raise ValueError("robot must be an object")
    for key, expected in (("model", "microduck"), ("hw_rev", 1), ("control_hz", 50)):
        value = robot.get(key)
        if value is None:
            issues.append(f"robot.{key} is not declared")
        elif value != expected or isinstance(value, bool):
            raise ValueError(f"unsupported robot.{key}: {value!r}")
    servos = robot.get("servos")
    if servos is None:
        issues.append("robot.servos is not declared")
    elif not isinstance(servos, str) or servos.strip().casefold() not in SUPPORTED_SERVO_DECLARATIONS:
        raise ValueError(f"unsupported robot.servos: {servos!r}")
    if manifest.get("action_scale") is None:
        issues.append("action_scale is not declared; installation needs review")
    command = manifest.get("command") or {}
    if not isinstance(command, dict):
        raise ValueError("command must be an object")
    for key in ("duration_s", "unwind_s", "action_scale"):
        value = manifest.get(key)
        if value is not None and (isinstance(value, bool) or not isinstance(value, (int, float)) or not 0 < value <= 300):
            raise ValueError(f"{key} must be a finite positive number <= 300")
    kind = manifest.get("kind")
    if kind not in ("episodic", "perpetual", "scripted", None):
        raise ValueError(f"unknown kind: {kind!r}")
    encoding = command.get("encoding", "constant")
    if encoding not in ("constant", "phase", "posture_flag"):
        issues.append(f"unsupported command encoding: {encoding}")
    elif encoding != "constant" or kind == "scripted":
        issues.append("Daemon-driven policy requires the upstream slot workflow; no generic skill install")
    elif kind == "episodic" and manifest.get("duration_s"):
        route = "skill"
    elif kind == "perpetual" and manifest.get("slot") in ("walk", "stand"):
        route = "slot"
    elif kind == "perpetual":
        issues.append("Held pose requires an explicit command and hold/unwind review")
        route = "review"
    else:
        issues.append("Missing kind or episodic duration; install needs review")
        route = "review"
    if "route" not in locals():
        route = "review"

    recipe = recipe_for_policy(repo, manifest, source) if repo else None
    simulation = {"status": "covered", "recipe": recipe, "scope": recipe["provenance"]["scope"]} if recipe else {"status": "not-covered", "reason": recipe_reason(repo, manifest, source)}
    return {
        "resolution": "ready" if not issues else "review",
        "install_route": route if not issues else "review",
        "unresolved": issues,
        "simulation": simulation,
    }


def classify(manifest, repo=None, source=None):
    return _manifest_diagnosis(manifest, repo or "", source or {})


def inspect_onnx(data: bytes) -> dict:
    import numpy as np
    import onnxruntime as ort
    options = ort.SessionOptions()
    options.intra_op_num_threads = 1
    options.inter_op_num_threads = 1
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_DISABLE_ALL
    session = ort.InferenceSession(data, sess_options=options, providers=["CPUExecutionProvider"])
    inputs, outputs = session.get_inputs(), session.get_outputs()

    def shape_ok(shape, width):
        return len(shape) == 2 and (shape[0] == 1 or isinstance(shape[0], str) or shape[0] is None) and shape[1] == width

    if len(inputs) != 1 or len(outputs) != 1 or inputs[0].type != "tensor(float)" or outputs[0].type != "tensor(float)" or not shape_ok(inputs[0].shape, 61) or not shape_ok(outputs[0].shape, 14):
        raise ValueError("expected a float ONNX with one [1,61] input and one [1,14] output")
    result = session.run(None, {inputs[0].name: np.zeros((1, 61), dtype=np.float32)})[0]
    if result.shape != (1, 14) or not np.isfinite(result).all():
        raise ValueError("ONNX zero-input smoke check returned invalid outputs")
    return {"input": inputs[0].shape, "output": outputs[0].shape, "smoke": "passed", "scope": "Shape and finite zero-input outputs only; not behavioral or hardware evidence."}


def _metadata(provider: str, repo: str, revision: str) -> dict:
    if provider == "github":
        endpoint = f"https://api.github.com/repos/{repo}/commits/{revision}"
    elif provider == "huggingface-space":
        endpoint = f"https://huggingface.co/api/spaces/{repo}/revision/{revision}"
    else:
        endpoint = f"https://huggingface.co/api/models/{repo}/revision/{revision}"
    return json.loads(fetch(endpoint, 8 * 1024 * 1024))


def _source_files(provider: str, repo: str, revision: str) -> list[str]:
    """List immutable source files for a provider without reading publisher code."""

    if provider == "github":
        tree = json.loads(fetch(f"https://api.github.com/repos/{repo}/git/trees/{revision}?recursive=1", 16 * 1024 * 1024))
        if not isinstance(tree, dict) or tree.get("truncated") is True:
            raise ValueError("GitHub source tree is unavailable or truncated")
        items = tree.get("tree", [])
        if not isinstance(items, list):
            raise ValueError("GitHub source tree is malformed")
        return sorted(
            item["path"]
            for item in items
            if isinstance(item, dict) and item.get("type") == "blob" and isinstance(item.get("path"), str)
        )
    metadata = _metadata(provider, repo, revision)
    siblings = metadata.get("siblings", []) if isinstance(metadata, dict) else []
    return sorted(
        item["rfilename"]
        for item in siblings
        if isinstance(item, dict) and isinstance(item.get("rfilename"), str)
    )


def _resolve_revision(provider: str, repo: str, revision: str) -> str:
    metadata = _metadata(provider, repo, revision)
    resolved = metadata.get("sha") if provider != "github" else metadata.get("sha")
    if not isinstance(resolved, str) or not SHA.fullmatch(resolved):
        raise ValueError("upstream did not return an immutable commit SHA")
    return resolved


def resolve_source(source: dict) -> dict:
    """Fetch and verify the exact authored source identity."""

    artifact_raw = fetch(source_artifact_url(source), 100 * 1024 * 1024)
    if digest(artifact_raw) != source["artifact_sha256"]:
        raise ValueError("pinned artifact hash mismatch")
    manifest = None
    manifest_raw = None
    if source["manifest_path"] is not None:
        manifest_raw = fetch(source_file_url(source, source["manifest_path"]), 2 * 1024 * 1024)
        if digest(manifest_raw) != source["manifest_sha256"]:
            raise ValueError("pinned manifest hash mismatch")
        manifest = json.loads(manifest_raw)
        if not isinstance(manifest, dict):
            raise ValueError("pinned policy manifest must be an object")

    if manifest is None:
        diagnosis = {
            "resolution": "review",
            "install_route": "review",
            "unresolved": ["No machine-readable policy manifest is published with this artifact."],
            "simulation": {"status": "not-covered", "reason": "No machine-readable policy manifest is published with this artifact."},
        }
    else:
        diagnosis = _manifest_diagnosis(manifest, source["repo"], source)
    license_name = None
    try:
        metadata = _metadata(source["provider"], source["repo"], source["revision"])
        card_data = metadata.get("cardData") or {}
        if isinstance(card_data, dict) and isinstance(card_data.get("license"), str) and card_data["license"].strip():
            license_name = card_data["license"]
    except Exception:
        if manifest is not None:
            diagnosis["unresolved"].append("Upstream license metadata could not be read; maintainer review required")
    if manifest is not None and license_name is None:
        diagnosis["unresolved"].append("Upstream metadata does not declare a license; maintainer review required")
    if diagnosis["unresolved"]:
        diagnosis["resolution"] = "review"
        diagnosis["install_route"] = "review"
    return {
        "source": source,
        "manifest": manifest,
        "license": license_name,
        "onnx": inspect_onnx(artifact_raw),
        **diagnosis,
    }


def _discover_source(provider: str, repo: str, revision: str) -> dict:
    immutable = _resolve_revision(provider, repo, revision)
    paths = _source_files(provider, repo, immutable)
    artifacts = [item for item in paths if item.lower().endswith(".onnx")]
    if len(artifacts) != 1:
        raise ValueError("source must publish exactly one ONNX artifact")
    artifact_path = artifacts[0]
    if not PATH.fullmatch(artifact_path):
        raise ValueError("ONNX artifact path is not a safe relative path")
    manifest_path = "manifest.json" if "manifest.json" in paths else None
    artifact_raw = fetch(source_file_url({"provider": provider, "repo": repo, "revision": immutable}, artifact_path), 100 * 1024 * 1024)
    manifest_raw = fetch(source_file_url({"provider": provider, "repo": repo, "revision": immutable}, manifest_path), 2 * 1024 * 1024) if manifest_path else None
    return {
        "provider": provider,
        "repo": repo,
        "revision": immutable,
        "artifact_path": artifact_path,
        "artifact_sha256": digest(artifact_raw),
        "manifest_path": manifest_path,
        "manifest_sha256": digest(manifest_raw) if manifest_raw else None,
    }


def resolve(url: str, expected: dict | None = None) -> dict:
    provider, repo, revision = parse_source_url(url)
    source = expected or _discover_source(provider, repo, revision)
    if expected is not None and (source.get("provider") != provider or source.get("repo") != repo):
        raise ValueError("source URL does not match the authored provider or repository")
    if expected is None:
        source["revision"] = _resolve_revision(provider, repo, revision)
    elif source["revision"] != revision and revision != "main":
        raise ValueError("source URL revision does not match the authored revision")
    return resolve_source(source)


def validate_policy(policy: dict) -> dict:
    if not isinstance(policy, dict) or set(policy) - {"id", "source", "curation", "media"}:
        raise ValueError("unknown policy fields")
    if not isinstance(policy.get("id"), str) or not SLUG.fullmatch(policy["id"]) or len(policy["id"]) > 100:
        raise ValueError("invalid policy id")
    source = policy.get("source")
    required = {"provider", "repo", "revision", "artifact_path", "artifact_sha256", "manifest_path", "manifest_sha256"}
    if (
        not isinstance(source, dict)
        or set(source) != required
        or source.get("provider") not in PROVIDERS
        or not isinstance(source.get("repo"), str)
        or not REPO.fullmatch(source["repo"])
        or not isinstance(source.get("revision"), str)
        or not SHA.fullmatch(source["revision"])
        or not isinstance(source.get("artifact_path"), str)
        or not PATH.fullmatch(source["artifact_path"])
        or not source["artifact_path"].lower().endswith(".onnx")
    ):
        raise ValueError("source requires provider, repository, immutable revision, safe ONNX path and hashes")
    if not isinstance(source.get("artifact_sha256"), str) or not SHA256.fullmatch(source["artifact_sha256"]):
        raise ValueError("invalid artifact SHA256")
    if (source["manifest_path"] is None) != (source["manifest_sha256"] is None):
        raise ValueError("manifest_path and manifest_sha256 must be both present or both null")
    if source["manifest_path"] is not None and (
        not isinstance(source["manifest_path"], str)
        or not PATH.fullmatch(source["manifest_path"])
        or not isinstance(source["manifest_sha256"], str)
        or not SHA256.fullmatch(source["manifest_sha256"])
    ):
        raise ValueError("invalid manifest path or SHA256")
    curation = policy.get("curation")
    if not isinstance(curation, dict) or set(curation) - {"category", "tags", "name", "summary", "details", "authors", "license", "notes"} or curation.get("category") not in CATEGORIES:
        raise ValueError("invalid curation")
    tags = curation.get("tags", [])
    if not isinstance(tags, list) or len(tags) > 20 or any(not isinstance(tag, str) or not 0 < len(tag) <= 80 for tag in tags):
        raise ValueError("invalid tags")
    for key, limit in (("name", 200), ("summary", 4000), ("details", 8000), ("license", 200), ("notes", 4000)):
        minimum = 2 if key == "name" else 1
        if key in curation and (not isinstance(curation[key], str) or not minimum <= len(curation[key]) <= limit):
            raise ValueError(f"invalid curation {key}")
    authors = curation.get("authors")
    if authors is not None and (not isinstance(authors, list) or not 1 <= len(authors) <= 20):
        raise ValueError("invalid authors")
    for author in authors or []:
        if not isinstance(author, dict) or set(author) - {"name", "affiliation", "github", "url"} or not isinstance(author.get("name"), str) or not 0 < len(author["name"]) <= 200:
            raise ValueError("invalid author")
        for key, limit in (("affiliation", 200), ("github", 39)):
            if key in author and (not isinstance(author[key], str) or not 0 < len(author[key]) <= limit):
                raise ValueError("invalid author")
        if "url" in author and (not isinstance(author["url"], str) or not author["url"]):
            raise ValueError("invalid author")
        if "github" in author and not re.fullmatch(r"(?:[A-Za-z0-9]|[A-Za-z0-9][A-Za-z0-9-]{0,37}[A-Za-z0-9])", author["github"]):
            raise ValueError("invalid author")
        if "url" in author:
            parsed = urllib.parse.urlsplit(author["url"])
            if parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password:
                raise ValueError("invalid author")
    media = policy.get("media", [])
    if not isinstance(media, list) or len(media) > 20:
        raise ValueError("invalid media")
    for item in media:
        parsed = urllib.parse.urlsplit(item.get("url", "")) if isinstance(item, dict) else None
        if not isinstance(item, dict) or set(item) != {"type", "url", "label"} or item["type"] not in ("video", "image") or parsed is None or parsed.scheme != "https" or not parsed.hostname or parsed.username or parsed.password or not isinstance(item["label"], str) or not 0 < len(item["label"]) <= 240:
            raise ValueError("invalid author media")
    return policy


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["resolve", "register", "prepare"])
    parser.add_argument("url", nargs="?")
    parser.add_argument("--id")
    parser.add_argument("--category", default="experimental", choices=sorted(CATEGORIES))
    args = parser.parse_args()
    if args.command == "prepare":
        target = ROOT / ".generated/policies"
        target.mkdir(parents=True, exist_ok=True)
        for stale in target.glob("*.json"):
            stale.unlink()
        for file in sorted((ROOT / "registry/policies").glob("*.json")):
            policy = validate_policy(json.loads(file.read_text()))
            if file.stem != policy["id"]:
                raise ValueError("policy filename must equal its id")
            result = resolve_source(policy["source"])
            (target / file.name).write_text(json.dumps({**policy, "resolved": result}, indent=2) + "\n")
        return
    if not args.url:
        parser.error("URL is required")
    result = resolve(args.url)
    if args.command == "resolve":
        print(json.dumps(result, indent=2))
        return
    policy_id = args.id or re.sub(r"[^a-z0-9]+", "-", result["source"]["repo"].lower()).strip("-")
    policy = validate_policy({"id": policy_id, "source": result["source"], "curation": {"category": args.category, "tags": []}})
    for file in (ROOT / "registry/policies").glob("*.json"):
        existing = json.loads(file.read_text())
        if existing["source"]["repo"].lower() == policy["source"]["repo"].lower():
            raise ValueError(f"repository already registered as {existing['id']}; update that policy in a normal PR")
    destination = ROOT / "registry/policies" / f"{policy_id}.json"
    with destination.open("x") as output:
        output.write(json.dumps(policy, indent=2) + "\n")
    print(json.dumps({"policy": str(destination.relative_to(ROOT)), "diagnosis": result}, indent=2))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        raise SystemExit(str(exc))
