#!/usr/bin/env python3
"""Run the deterministic MuJoCo preflight and rollout for one ExecutionSpec."""

from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import math
import os
import re
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
os.environ.setdefault("MUJOCO_GL", "egl")

import mujoco  # noqa: E402

from evidence import evidence_key, inputs_digest  # noqa: E402
from execution import ExecutionSpec, artifact_url, execution_spec_from_policy  # noqa: E402
from http_download import open_download  # noqa: E402
from microduck_sim import checks, render  # noqa: E402
from microduck_sim.preflight import SimulationPreflightError, require_valid  # noqa: E402
from microduck_sim.robot import DuckRuntime, load_model  # noqa: E402
from microduck_sim.scenarios import make_command_fn, scenario_from_recipe  # noqa: E402

REPO_ROOT = HERE.parent
ALLOWED_HOSTS = ("huggingface.co", "raw.githubusercontent.com")
MAX_ONNX_BYTES = 100 * 1024 * 1024


def load_policy_resolution(entry_id: str) -> tuple[dict, dict]:
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", entry_id):
        raise ValueError("invalid entry id")
    policy_path = REPO_ROOT / "registry" / "policies" / f"{entry_id}.json"
    if not policy_path.exists():
        raise SystemExit(f"no authored policy at {policy_path}")
    policy = json.loads(policy_path.read_text())
    generated_path = REPO_ROOT / ".generated" / "policies" / f"{entry_id}.json"
    if not generated_path.exists():
        return policy, {
            "source": policy["source"],
            "manifest": None,
            "resolution": "review",
            "install_route": "review",
            "unresolved": ["Policy has not been resolved by the build preparation step."],
            "onnx": {},
            "simulation": {"status": "not-covered", "reason": "Policy has not been resolved by the build preparation step."},
        }
    generated = json.loads(generated_path.read_text())
    resolved = generated.get("resolved", generated)
    if not isinstance(resolved, dict) or resolved.get("source") != policy.get("source"):
        raise ValueError(f"stale generated policy resolution: {generated_path}")
    return policy, resolved


def download_onnx(spec: ExecutionSpec, dest_dir: Path) -> Path:
    parsed = urllib.parse.urlsplit(spec.artifact_url)
    if parsed.hostname not in ALLOWED_HOSTS:
        raise ValueError(f"artifact host not allowed: {spec.artifact_url}")
    filename = Path(parsed.path).name or f"{spec.entry_id}.onnx"
    dest = dest_dir / filename
    request = urllib.request.Request(spec.artifact_url, headers={"User-Agent": "uduck-registry-ci"})
    with open_download(request, timeout=300) as response, dest.open("wb") as output:
        size = 0
        while True:
            chunk = response.read(1 << 20)
            if not chunk:
                break
            size += len(chunk)
            if size > MAX_ONNX_BYTES:
                raise ValueError("ONNX artifact exceeds 100 MB sanity bound")
            output.write(chunk)
    actual = hashlib.sha256(dest.read_bytes()).hexdigest()
    if actual != spec.artifact_sha256:
        raise ValueError(f"policy artifact hash mismatch: expected {spec.artifact_sha256}, got {actual}")
    return dest


def identity_fields(entry_id: str, source: dict) -> dict[str, str]:
    inputs = inputs_digest(entry_id)
    artifact = source["artifact_sha256"]
    return {"inputs_sha256": inputs, "evidence_key": evidence_key(inputs, artifact)}


def write_report(out_dir: Path, entry_id: str, report: dict) -> Path:
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", entry_id):
        raise ValueError("invalid entry id")
    target = out_dir / entry_id
    target.mkdir(parents=True, exist_ok=True)
    report_path = target / "report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    return report_path


def not_covered_report(entry_id: str, source: dict, reason: str) -> dict:
    report = {
        "entry": entry_id,
        "execution": "not-covered",
        "reason": reason,
        "source": source,
        "policy": {"url": artifact_url(source), "sha256": source["artifact_sha256"]},
        "media": None,
        "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
    }
    report.update(identity_fields(entry_id, source))
    return report


def run(entry_id: str, out_dir: Path, keep_media: bool) -> int:
    policy, resolved = load_policy_resolution(entry_id)
    spec = execution_spec_from_policy(policy, resolved)
    if spec is None:
        simulation = resolved.get("simulation")
        reason = simulation.get("reason", "No maintainer-owned execution recipe covers this source.") if isinstance(simulation, dict) else "No maintainer-owned execution recipe covers this source."
        report_path = write_report(out_dir, entry_id, not_covered_report(entry_id, policy["source"], reason))
        print(f"[{entry_id}] NOT COVERED ({reason}) -> {report_path}")
        return 0

    try:
        preflight = require_valid(spec)
    except SimulationPreflightError as exc:
        report = not_covered_report(entry_id, spec.source, "ExecutionSpec failed preflight.")
        report.update({"execution": "rejected", "reason": "execution_preflight", "preflight": {"status": "rejected", "errors": list(exc.result.errors), "warnings": list(exc.result.warnings)}})
        report_path = write_report(out_dir, entry_id, report)
        print(f"[{entry_id}] REJECTED by simulation preflight -> {report_path}", file=sys.stderr)
        return 2

    simulation_model = spec.model
    scenario = scenario_from_recipe(spec.recipe)
    duration = float(spec.recipe["duration_s"])
    with tempfile.TemporaryDirectory(prefix="uduck-sim-") as temporary:
        onnx_path = download_onnx(spec, Path(temporary))
        from fetch_assets import fetch
        asset_variant = "rollers" if simulation_model == "microduck-rollers" else "standard"
        model = load_model(fetch(variant=asset_variant))
        print(f"[sim] loading runtime for {entry_id}...", flush=True)
        action_scale = spec.contract.get("action_scale")
        if isinstance(action_scale, bool) or not isinstance(action_scale, (int, float)) or not math.isfinite(float(action_scale)):
            raise ValueError("ExecutionSpec requires an explicit finite action_scale")
        runtime = DuckRuntime(model, onnx_path, action_scale=float(action_scale))
        runtime.prepare_start(spec.recipe["start"])
        command_fn = make_command_fn(scenario, runtime.use_13d)
        renderer = render.LoopRenderer(model)
        renderer.attach(runtime.data)

        def hook(step, sample):
            if step % 50 == 0:
                print(f"[sim] step {step}/{int(duration * 50)}", flush=True)
            renderer.capture(step, sample)

        result = runtime.rollout(command_fn, duration, frame_hook=hook)
        report = checks.evaluate(result, scenario)
        media = renderer.finalize(out_dir / entry_id, f"registry sim {entry_id} (flat-v1, 50 Hz)") if keep_media else None
        report.update({
            "entry": entry_id,
            "source": spec.source,
            "manifest": spec.manifest,
            "recipe": spec.recipe,
            "duration_s": duration,
            "policy": {"url": spec.artifact_url, "sha256": spec.artifact_sha256},
            "media": media,
            "preflight": {"status": "passed", "warnings": list(preflight.warnings)},
            "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
            "runtime": {"mjcf": f"{'robot_allcollisions_rollers.xml' if asset_variant == 'rollers' else 'robot_allcollisions.xml'} (pinned registry asset)", "timestep_s": 0.005, "decimation": 4, "control_hz": 50, "renderer": "mujoco EGL offscreen"},
        })
        report.update(identity_fields(entry_id, spec.source))
    report_path = write_report(out_dir, entry_id, report)
    print(f"[{entry_id}] RENDERED; CHECKS {report['checks_status'].upper()} -> {report_path}")
    for check in report["checks"]:
        print(f"  {'PASS' if check['passed'] else 'FAIL'} {check['check']}: {check['detail']}")
    return 0 if report["checks_status"] == "passed" else 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--entry", required=True)
    parser.add_argument("--out", default=str(REPO_ROOT / "sim-results"))
    parser.add_argument("--keep-media", action="store_true", help="render loop.mp4 / poster.png")
    args = parser.parse_args()
    try:
        return run(args.entry, Path(args.out), args.keep_media)
    except Exception as exc:  # noqa: BLE001
        try:
            policy_path = REPO_ROOT / "registry" / "policies" / f"{args.entry}.json"
            source = json.loads(policy_path.read_text())["source"] if policy_path.exists() else {"artifact_sha256": "0" * 64}
            report = {"entry": args.entry, "execution": "failed", "error": str(exc), "source": source, "policy": {"url": artifact_url(source), "sha256": source["artifact_sha256"]}, "media": None, "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat()}
            if "artifact_sha256" in source:
                report.update(identity_fields(args.entry, source))
            write_report(Path(args.out), args.entry, report)
        except Exception:
            pass
        print(f"ERROR running execution for {args.entry}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
