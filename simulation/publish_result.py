#!/usr/bin/env python3
"""Promote one reviewed registry simulation artifact into the static site."""

from __future__ import annotations

import argparse
import json
import re
import shutil
from pathlib import Path
from evidence import inputs_digest, evidence_key

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent
ID_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def publish(source: Path) -> Path:
    source = source.resolve()
    report_path = source / "report.json"
    loop_path = source / "loop.mp4"
    poster_path = source / "poster.png"
    for path in (report_path, loop_path, poster_path):
        if not path.is_file():
            raise ValueError(f"missing generated artifact: {path}")

    report = json.loads(report_path.read_text())
    behavior_id = report.get("behavior")
    if not isinstance(behavior_id, str) or not ID_PATTERN.fullmatch(behavior_id):
        raise ValueError("report has no safe behavior id")
    if report.get("execution") != "rendered":
        raise ValueError("only a completed diagnostic render can be published")
    descriptor = REPO_ROOT / "registry" / "behaviors" / f"{behavior_id}.json"
    if not descriptor.is_file():
        raise ValueError(f"no registry descriptor for {behavior_id}")

    identity = inputs_digest(behavior_id)
    if report.get("inputs_sha256") != identity:
        raise ValueError("Evidence does not match the current descriptor and runner")
    key = evidence_key(identity, report.get("policy", {}).get("sha256", ""))
    if report.get("evidence_key") != key:
        raise ValueError("Invalid evidence identity")
    target = REPO_ROOT / "public" / "media" / "registry-sim" / behavior_id
    target.mkdir(parents=True, exist_ok=True)
    shutil.copy2(loop_path, target / "loop.mp4")
    shutil.copy2(poster_path, target / "poster.png")
    report["media"] = {
        "loop_url": f"/media/registry-sim/{behavior_id}/loop.mp4",
        "poster_url": f"/media/registry-sim/{behavior_id}/poster.png",
    }
    (target / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    return target


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path, help="sim-results/<behavior-id> directory")
    args = parser.parse_args()
    try:
        target = publish(args.source)
    except Exception as exc:  # noqa: BLE001
        parser.error(str(exc))
    print(f"published reviewed registry simulation to {target}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
