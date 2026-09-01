#!/usr/bin/env python3
"""Run the standardized simulation check for one registry behavior.

Usage:
  python -m run_check --behavior alpha-walking [--out OUT_DIR] [--keep-media]

Reads `registry/behaviors/<id>.json`, downloads the canonical ONNX (hosts are
restricted to the registry artifact allowlist), derives the command profile
from `compatibility.robotd_slot` (or the optional `simulation` block), runs a
deterministic MuJoCo rollout at the 50 Hz runtime contract, then writes:

  OUT/<id>/report.json  verdict, checks, metrics, provenance
  OUT/<id>/loop.mp4     standardized 512x512 H.264 render loop
  OUT/<id>/poster.png   standardized poster (middle frame + caption bar)

Exit code 0 = pass, 1 = fail, 2 = error (could not run at all).
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

from microduck_sim import checks, render  # noqa: E402
from microduck_sim.profiles import make_command_fn, profile_from_descriptor  # noqa: E402
from microduck_sim.robot import DuckRuntime, load_model  # noqa: E402

REPO_ROOT = HERE.parent
ALLOWED_HOSTS = ("huggingface.co", "raw.githubusercontent.com")
DEFAULT_DURATION_S = 6.0
MAX_ONNX_BYTES = 100 * 1024 * 1024


def load_descriptor(behavior_id: str) -> dict:
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
    contract = descriptor["contract"]
    slot = descriptor["compatibility"]["robotd_slot"]
    sim_block = descriptor.get("simulation")
    spec = profile_from_descriptor(sim_block, slot)
    duration = float(sim_block.get("duration_s", DEFAULT_DURATION_S)) if sim_block else \
        (sum(s[0] for s in spec.segments) if spec.segments else DEFAULT_DURATION_S)
    if not sim_block and spec.kind in ("oneshot_zero", "oneshot_phase"):
        # Gesture window plus a 2 s settle before the recovery check.
        duration = spec.duration_s + 2.0

    with tempfile.TemporaryDirectory(prefix="uduck-sim-") as tmp:
        onnx_path = download_onnx(descriptor, Path(tmp))
        onnx_sha = hashlib.sha256(onnx_path.read_bytes()).hexdigest()

        from fetch_assets import fetch
        mjcf = fetch()
        model = load_model(mjcf)

        print(f"[sim] loading runtime for {behavior_id}...", flush=True)
        runtime = DuckRuntime(model, onnx_path,
                              action_scale=float(contract.get("action_scale", 1.0)))
        command_fn = make_command_fn(spec, runtime.use_13d)
        print(f"[sim] obs_dim={runtime.obs_dim} profile={spec.name or spec.kind} "
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
            caption = f"{descriptor['name']} - sim (MuJoCo, 50 Hz)"
            media = renderer.finalize(out_dir / behavior_id, caption)

    report.update({
        "behavior": behavior_id,
        "profile": spec.name or spec.kind,
        "duration_s": duration,
        "policy": {
            "url": descriptor["artifacts"]["onnx"]["url"],
            "sha256": onnx_sha,
            "baked_normalizer": descriptor["artifacts"]["onnx"].get("baked_normalizer"),
        },
        "media": media,
        "generated_at": _dt.datetime.now(_dt.timezone.utc).isoformat(),
        "sim": {
            "mjcf": "robot_allcollisions.xml (pollen-robotics/microduck-simulator, pinned)",
            "timestep_s": 0.005,
            "decimation": 4,
            "control_hz": 50,
            "renderer": "mujoco EGL offscreen",
        },
    })
    (out_dir / behavior_id).mkdir(parents=True, exist_ok=True)
    report_path = out_dir / behavior_id / "report.json"
    report_path.write_text(json.dumps(report, indent=2) + "\n")

    print(f"[{behavior_id}] {report['verdict'].upper()} -> {report_path}")
    for c in report["checks"]:
        print(f"  {'PASS' if c['passed'] else 'FAIL'} {c['check']}: {c['detail']}")
    return 0 if report["verdict"] == "pass" else 1


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
        print(f"ERROR running sim for {args.behavior}: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
