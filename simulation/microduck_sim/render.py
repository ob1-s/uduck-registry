"""Standardized offscreen rendering: deterministic camera, H.264 loop, poster.

Output contract (the "sim render standard"):
- loop.mp4 : H.264 yuv420p, 30 fps, square 512x512, muted, ~CRF 20,
             duration == rollout duration, deterministic given the rollout.
- poster.png : the middle frame, 512x512, with an inset bottom caption bar.

The camera is a smoothed chase view (side-on, slight elevation) so every
behavior gets a comparable, stable thumbnail.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

os.environ.setdefault("MUJOCO_GL", "egl")

import mujoco  # noqa: E402  (import after MUJOCO_GL is pinned)
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw  # noqa: E402

LOOP_SIZE = 512
LOOP_FPS = 30
SOURCE_FPS = 25  # 50 Hz control, sampled every other step
CAM_DISTANCE = 0.72
CAM_ELEVATION = -12.0
CAM_AZIMUTH = 100.0
CAM_SMOOTH = 0.2  # per-control-step lookat lerp factor


class LoopRenderer:
    """Collects frames during a rollout and encodes the standardized outputs."""

    def __init__(self, model: mujoco.MjModel):
        self.renderer = mujoco.Renderer(model, height=LOOP_SIZE, width=LOOP_SIZE)
        self.cam = mujoco.MjvCamera()
        self.cam.type = mujoco.mjtCamera.mjCAMERA_FREE
        self.cam.distance = CAM_DISTANCE
        self.cam.elevation = CAM_ELEVATION
        self.cam.azimuth = CAM_AZIMUTH
        self._lookat = None
        self._frames: list[np.ndarray] = []

    def capture(self, step_index: int, sample) -> None:
        # Render every other control step: 50 Hz sim -> 25 fps source. The
        # encoder declares that source rate and converts it to the 30 fps
        # delivery rate, so the loop keeps the rollout's real duration.
        if step_index % 2 != 0:
            return
        pos = np.asarray(sample.trunk_pos, dtype=float)
        if self._lookat is None:
            self._lookat = pos.copy()
        else:
            self._lookat = (1.0 - CAM_SMOOTH) * self._lookat + CAM_SMOOTH * pos
        self.cam.lookat[:] = self._lookat
        self.renderer.update_scene(self._data, camera=self.cam)
        self._frames.append(self.renderer.render().copy())

    def attach(self, data: mujoco.MjData) -> None:
        self._data = data

    def _encode_video(self, out_path: Path) -> None:
        ffmpeg = shutil.which("ffmpeg")
        if ffmpeg is None:
            raise RuntimeError("ffmpeg not found on PATH")
        h, w = self._frames[0].shape[:2]
        proc = subprocess.Popen(
            [ffmpeg, "-y", "-loglevel", "error",
             "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{w}x{h}",
             "-framerate", str(SOURCE_FPS), "-i", "-",
             "-r", str(LOOP_FPS),
             "-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20",
             "-movflags", "+faststart", str(out_path)],
            stdin=subprocess.PIPE)
        for frame in self._frames:
            proc.stdin.write(frame.tobytes())
        proc.stdin.close()
        if proc.wait() != 0:
            raise RuntimeError(f"ffmpeg failed encoding {out_path}")

    def _encode_poster(self, out_path: Path, caption: str) -> None:
        mid = self._frames[len(self._frames) // 2]
        img = Image.fromarray(mid)
        bar_h = 44
        bar = Image.new("RGB", (img.width, bar_h), (17, 24, 39))
        draw = ImageDraw.Draw(bar)
        draw.text((10, 15), caption, fill=(226, 232, 240))
        img.paste(bar, (0, img.height - bar_h))
        img.save(out_path)

    def finalize(self, out_dir: Path, caption: str) -> dict:
        out_dir = Path(out_dir)
        out_dir.mkdir(parents=True, exist_ok=True)
        loop_path = out_dir / "loop.mp4"
        poster_path = out_dir / "poster.png"
        self._encode_video(loop_path)
        self._encode_poster(poster_path, caption)
        self.renderer.close()
        return {
            "loop": str(loop_path),
            "poster": str(poster_path),
            "frames": len(self._frames),
            "size": LOOP_SIZE,
            "fps": LOOP_FPS,
        }
