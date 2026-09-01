#!/usr/bin/env python3
"""Download and hash-verify the pinned upstream Microduck simulation assets.

Assets: the official `pollen-robotics/microduck-simulator` Space's
`robot_allcollisions.xml` plus its 38 mesh files. `assets.lock.json` pins
URLs and sha256 digests so CI rollouts are reproducible.

Usage: python fetch_assets.py [--cache-dir DIR]   (default: <repo>/.simcache)
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from pathlib import Path

LOCK = Path(__file__).resolve().parent / "assets.lock.json"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(cache_dir: Path | None = None) -> Path:
    if cache_dir is None:
        repo_root = Path(__file__).resolve().parent.parent
        cache_dir = repo_root / ".simcache"
    lock = json.loads(LOCK.read_text())
    model_dir = cache_dir / lock["model_dir"]
    mesh_dir = model_dir / "assets"
    mesh_dir.mkdir(parents=True, exist_ok=True)

    import urllib.request

    def get(url: str, dest: Path) -> None:
        req = urllib.request.Request(url, headers={"User-Agent": "uduck-registry-ci"})
        with urllib.request.urlopen(req, timeout=120) as resp, dest.open("wb") as out:
            while True:
                chunk = resp.read(1 << 20)
                if not chunk:
                    break
                out.write(chunk)

    failures = []
    for entry in lock["files"]:
        name = entry["path"]
        dest = model_dir / name
        expected = entry["sha256"]
        if dest.exists() and sha256(dest) == expected:
            continue
        print(f"fetch {name}")
        try:
            get(entry["url"], dest)
        except Exception as exc:  # noqa: BLE001
            failures.append(f"{name}: {exc}")
            continue
        actual = sha256(dest)
        if actual != expected:
            failures.append(f"{name}: sha256 mismatch ({actual} != {expected})")
            dest.unlink(missing_ok=True)
    if failures:
        for f in failures:
            print(f"ERROR {f}", file=sys.stderr)
        sys.exit(1)
    resolved = model_dir / lock["model_path"]
    print(f"assets ready: {resolved}")
    return resolved


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache-dir", default=None)
    args = parser.parse_args()
    repo_root = Path(__file__).resolve().parent.parent
    default_cache = repo_root / ".simcache"
    fetch(Path(args.cache_dir) if args.cache_dir else default_cache)
