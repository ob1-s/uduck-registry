#!/usr/bin/env python3
"""Run the standardized simulation check for one registry behavior.

Usage:
  python -m run_check --behavior alpha-walking [--out OUT_DIR] [--keep-media]

Reads `registry/behaviors/<id>.json`, downloads the canonical ONNX (hosts are
restricted to the registry artifact allowlist), executes the descriptor's
explicit registry simulation recipe, runs a
deterministic MuJoCo rollout at the 50 Hz runtime contract, then writes:

  OUT/<id>/report.json  execution status, exact checks, observations, provenance
  OUT/<id>/loop.mp4     standardized 512x512 H.264 render loop
  OUT/<id>/poster.png   standardized poster (middle frame + caption bar)

Exit code 0 = rendered/unsupported, 1 = requested check failed,
2 = preflight rejection or error (could not run at all).
"""

from __future__ import annotations

import argparse
import datetime as _dt
import hashlib
import json
import os
import re
import sys
import tempfile
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

os.environ.setdefault("MUJOCO_GL", "egl")

import mujoco  # noqa: E402

from evidence import inputs_digest, evidence_key
from microduck_sim import checks, render  # noqa: E402
from microduck_sim.preflight import SimulationPreflightError, require_valid  # noqa: E402
from microduck_sim.scenarios import make_command_fn, scenario_from_descriptor  # noqa: E402
from microduck_sim.robot import DuckRuntime, load_model  # noqa: E402

REPO_ROOT = HERE.parent
ALLOWED_HOSTS = ("huggingface.co", "raw.githubusercontent.com")
MAX_ONNX_BYTES = 100 * 1024 * 1024


def load_descriptor(behavior_id: str) -> dict:
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", behavior_id):
        raise ValueError("Invalid behavior id")
    path = REPO_ROOT / "registry" / "behaviors" / f"{behavior_id}.json"
    if not path.exists():
        raise SystemExit(f"no descriptor at {path}")
    return json.loads(path.read_text())


def download_onnx(descriptor: dict, dest_dir: Path) -> Path:
    url = descriptor["artifacts"]["onnx"]["url"]
    host = re.match(r"https://([^/]+)/", url)
    if not host or host.group(1) not in ALLOWED_HOSTS:
        raise ValueError(f"artifact host not allowed: {url}")
    filename = descriptor["artifacts"]["onnx"].get("filename") or url.rsplit("/", 1)[-1]
    dest = dest_dir / filename
    if not dest.exists():
        req = urllib.request.Request(url, headers={"User-Agent": "uduck-registry-ci"})
        with urllib.request.urlopen(req, timeout=300) as resp, dest.open("wb") as out:
            size = 0
            while True:
                chunk = resp.read(1 << 20)
                if not chunk:
                    break
                size += len(chunk)
                if size > MAX_ONNX_BYTES:
                    raise ValueError("ONNX artifact exceeds 100 MB sanity bound")
                out.write(chunk)
    return dest


def run(behavior_id: str, out_dir: Path, keep_media: bool) -> int:
    descriptor = load_descriptor(behavior_id)
    try:
        preflight = require_valid(descriptor)
    except SimulationPreflightError as exc:
        report = {
            "behavior": behavior_id,
            "execution": "rejected",
            "reason": "simulation_preflight",
            "preflight": {
                "status": "rejected",
                "errors": list(exc.result.errors),
                "warnings": list(exc.result.warnings),
            },
            "media": None,
            "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        }
        report_path = write_report(out_dir, behavior_id, report)
        print(f"[{behavior_id}] REJECTED by simulation preflight -> {report_path}", file=sys.stderr)
        for error in exc.result.errors:
            print(f"  ERROR {error}", file=sys.stderr)
        return 2
    sim_block = descriptor.get("simulation")
    if not sim_block or sim_block.get("runner") == "external":
        reason = sim_block.get("reason", "no_registry_recipe") if sim_block else \
            "no_registry_recipe"
        report = {
            "behavior": behavior_id,
            "execution": "unsupported",
            "reason": reason,
            "notes": sim_block.get("notes") if sim_block else None,
            "media": None,
            "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        }
        write_report(out_dir, behavior_id, report)
        print(f"[{behavior_id}] UNSUPPORTED ({reason})")
        return 0

    contract = descriptor["contract"]
    robot_model = descriptor["compatibility"]["robot_model"]
    simulation_model = sim_block.get("model", robot_model)
    if simulation_model != robot_model:
        raise ValueError(
            f"simulation model {simulation_model!r} must match compatibility model "
            f"{robot_model!r}"
        )
    if simulation_model not in ("microduck-standard", "microduck-rollers"):
        raise ValueError(
            f"microduck-standard-v1 does not support the {simulation_model!r} model"
        )
    if sim_block["scene"] != "flat-v1":
        raise ValueError(f"unsupported registry scene: {sim_block['scene']}")
    spec = scenario_from_descriptor(sim_block)
    duration = float(sim_block["duration_s"])

    with tempfile.TemporaryDirectory(prefix="uduck-sim-") as tmp:
        onnx_path = download_onnx(descriptor, Path(tmp))
        onnx_sha = hashlib.sha256(onnx_path.read_bytes()).hexdigest()

        from fetch_assets import fetch
        asset_variant = "rollers" if simulation_model == "microduck-rollers" else "standard"
        mjcf = fetch(variant=asset_variant)
        model = load_model(mjcf)

        print(f"[sim] loading runtime for {behavior_id}...", flush=True)
        runtime = DuckRuntime(model, onnx_path,
                              action_scale=float(contract.get("action_scale", 1.0)))
        runtime.prepare_start(sim_block["start"])
        command_fn = make_command_fn(spec, runtime.use_13d)
        print(f"[sim] obs_dim={runtime.obs_dim} scenario={spec.name or spec.kind} "
              f"duration={duration}s", flush=True)

        renderer = render.LoopRenderer(model)
        renderer.attach(runtime.data)

        def hook(k, sample):
            if k % 50 == 0:
                print(f"[sim] step {k}/{int(duration * 50)}", flush=True)
            renderer.capture(k, sample)

        result = runtime.rollout(command_fn, duration, frame_hook=hook)
        report = checks.evaluate(result, spec)

        media = None
        if keep_media:
            caption = f"{descriptor['name']} - registry sim (flat-v1, 50 Hz)"
            media = renderer.finalize(out_dir / behavior_id, caption)

        identity = inputs_digest(behavior_id)
        report.update({
            "inputs_sha256": identity,
            "evidence_key": evidence_key(identity, onnx_sha),
            "behavior": behavior_id,
            "recipe": {
                "runner": sim_block["runner"],
                "model": simulation_model,
                "scene": sim_block["scene"],
                "start": sim_block["start"],
                "scenario": spec.name or spec.kind,
            },
            "duration_s": duration,
            "policy": {
                "url": descriptor["artifacts"]["onnx"]["url"],
                "sha256": onnx_sha,
                "baked_normalizer": descriptor["artifacts"]["onnx"].get("baked_normalizer"),
            },
            "media": media,
            "preflight": {
                "status": "passed",
                "warnings": list(preflight.warnings),
            },
            "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
            "runtime": {
                "mjcf": f"{'robot_allcollisions_rollers.xml' if asset_variant == 'rollers' else 'robot_allcollisions.xml'} "
                        "(pollen-robotics/microduck-simulator, pinned)",
                "timestep_s": 0.005,
                "decimation": 4,
                "control_hz": 50,
                "renderer": "mujoco EGL offscreen",
            },
        })
    report_path = write_report(out_dir, behavior_id, report)

    print(f"[{behavior_id}] RENDERED; CHECKS {report['checks_status'].upper()} -> {report_path}")
    for c in report["checks"]:
        print(f"  {'PASS' if c['passed'] else 'FAIL'} {c['check']}: {c['detail']}")
    return 0 if report["checks_status"] == "passed" else 1


def write_report(out_dir: Path, behavior_id: str, report: dict) -> Path:
    target = out_dir / behavior_id
    target.mkdir(parents=True, exist_ok=True)
    report_path = target / "report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")
    return report_path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--behavior", required=True)
    parser.add_argument("--out", default=str(REPO_ROOT / "sim-results"))
    parser.add_argument("--keep-media", action="store_true",
                        help="render the loop.mp4 / poster.png (slower)")
    args = parser.parse_args()
    try:
        return run(args.behavior, Path(args.out), args.keep_media)
    except Exception as exc:  # noqa: BLE001
        write_report(Path(args.out), args.behavior, {
            "behavior": args.behavior,
            "execution": "failed",
            "error": str(exc),
            "media": None,
            "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        })
        print(f"ERROR running sim for {args.behavior}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
