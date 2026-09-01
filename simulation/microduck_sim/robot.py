"""MuJoCo Microduck runtime: faithful headless port of the upstream policy loop.

Reference: `pollen-robotics/microduck_rl` `scripts/infer_policy.py` and the
official `pollen-robotics/microduck-simulator` Space. The physics model is the
Space's `robot_allcollisions.xml` (meshes vendored, hash-pinned in
`simulation/assets.lock.json`); a plain floor and lights are injected for CI
rendering, matching how the Space's `game.js` injects a floor.

Deviations from hardware inference are limited to:
- no action delay / domain randomization (deterministic CI rollout);
- floor + lights appended to the MJCF (visual only, plus ground contact).
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

import mujoco
import numpy as np
import onnxruntime as ort

from .constants import (
    ACTION_SCALE,
    DECIMATION,
    DEFAULT_POSE,
    INITIAL_TRUNK_Z,
    TIMESTEP,
    TRUNK_BODY,
    TRUNK_FREEJOINT,
    IMU_GYRO_SENSOR,
    quat_rotate_inverse,
)

# Floor + lights injected into the vendored MJCF (which is robot-only).
_FLOOR_XML = """
  <light name="ci_key" directional="true" pos="0 0 3" dir="0 0 -1" diffuse="0.85 0.85 0.9" ambient="0.35 0.35 0.38" castshadow="true"/>
  <light name="ci_fill" directional="true" pos="-2 -2 2" dir="0.7 0.7 -0.6" diffuse="0.3 0.3 0.35" ambient="0 0 0"/>
  <geom name="ci_floor" type="plane" size="8 8 0.05" rgba="0.90 0.90 0.92 1" condim="3" friction="1.0 0.005 0.0001"/>
"""


def load_model(mjcf_path: str | Path) -> mujoco.MjModel:
    """Load the Microduck MJCF with the runtime's timestep and CI floor."""
    mjcf_path = Path(mjcf_path).resolve()
    xml = mjcf_path.read_text()
    # Inject floor/lights right after <worldbody>.
    idx = xml.index("<worldbody>") + len("<worldbody>")
    xml = xml[:idx] + "\n" + _FLOOR_XML + xml[idx:]
    # from_xml_string resolves the MJCF's relative meshdir against the process
    # CWD, so scope a chdir to the model directory.
    prev = os.getcwd()
    os.chdir(mjcf_path.parent)
    try:
        model = mujoco.MjModel.from_xml_string(xml)
    finally:
        os.chdir(prev)
    model.opt.timestep = TIMESTEP
    # Offscreen framebuffer sized for the standardized 512x512 render loop.
    model.vis.global_.offwidth = 512
    model.vis.global_.offheight = 512
    return model


@dataclass
class StepSample:
    """One 50 Hz control step of recorded telemetry."""

    t: float
    command: np.ndarray
    action: np.ndarray
    trunk_height: float
    trunk_pos: np.ndarray
    upright_z: float  # projected-gravity z (-1 = perfectly upright)
    lin_vel_world: np.ndarray


@dataclass
class RolloutResult:
    samples: list = field(default_factory=list)
    obs_dim: int = 0
    use_13d: bool = True
    control_steps: int = 0
    sim_steps: int = 0
    duration_s: float = 0.0

    def metrics(self) -> dict:
        h = np.array([s.trunk_height for s in self.samples])
        uz = np.array([s.upright_z for s in self.samples])
        xy = np.array([s.trunk_pos[:2] for s in self.samples])
        acts = np.array([s.action for s in self.samples])
        finite = bool(np.isfinite(acts).all() and np.isfinite(h).all())
        return {
            "duration_s": round(self.duration_s, 3),
            "control_steps": self.control_steps,
            "obs_dim": self.obs_dim,
            "command_dim": 13 if self.use_13d else 3,
            "min_trunk_height_m": round(float(h.min()), 4),
            "final_trunk_height_m": round(float(h[-1]), 4),
            "max_tilt_deg": round(float(np.degrees(np.arccos(np.clip(-uz.min(), -1, 1)))), 2),
            "final_tilt_deg": round(float(np.degrees(np.arccos(np.clip(-uz[-1], -1, 1)))), 2),
            "path_length_m": round(float(float(np.abs(np.diff(xy, axis=0)).sum())), 3),
            "displacement_m": round(float(np.linalg.norm(xy[-1] - xy[0])), 3),
            "max_abs_action": round(float(np.abs(acts).max()), 4),
            "all_finite": finite,
        }


class DuckRuntime:
    """Deterministic Microduck policy rollout in MuJoCo."""

    def __init__(self, model: mujoco.MjModel, onnx_path, action_scale: float = ACTION_SCALE):
        self.model = model
        self.data = mujoco.MjData(model)
        self.action_scale = float(action_scale)

        so = ort.SessionOptions()
        so.intra_op_num_threads = 2
        self.session = ort.InferenceSession(str(onnx_path), so,
                                            providers=["CPUExecutionProvider"])
        self.input_name = self.session.get_inputs()[0].name
        self.output_name = self.session.get_outputs()[0].name
        in_shape = self.session.get_inputs()[0].shape
        last = in_shape[-1] if isinstance(in_shape[-1], int) else None
        if last not in (51, 61, None):
            raise ValueError(f"Policy expects {in_shape}; expected 51 or 61 obs dims")
        self.use_13d = last is None or last == 61
        self.obs_dim = 61 if self.use_13d else 51

        self.imu_ang_vel_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_SENSOR,
                                                IMU_GYRO_SENSOR)
        if self.imu_ang_vel_id < 0:
            raise ValueError("Sensor 'imu_ang_vel' missing from MJCF")
        self.trunk_base_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, TRUNK_BODY)
        trunk_jid = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, TRUNK_FREEJOINT)
        self._trunk_qpos_adr = int(model.jnt_qposadr[trunk_jid])
        self._trunk_qvel_adr = int(model.jnt_dofadr[trunk_jid])
        self.n_joints = model.nu
        self.joint_qpos_indices = [
            int(model.jnt_qposadr[model.actuator_trnid[i, 0]]) for i in range(model.nu)
        ]
        self.joint_qvel_indices = [
            int(model.jnt_dofadr[model.actuator_trnid[i, 0]]) for i in range(model.nu)
        ]
        self.default_pose = DEFAULT_POSE[: self.n_joints]
        self.last_action = np.zeros(self.n_joints, dtype=np.float32)
        self.reset()

    def reset(self) -> None:
        mujoco.mj_resetData(self.model, self.data)
        adr = self._trunk_qpos_adr
        self.data.qpos[adr + 0] = 0.0
        self.data.qpos[adr + 1] = 0.0
        self.data.qpos[adr + 2] = INITIAL_TRUNK_Z
        self.data.qpos[adr + 3:adr + 7] = [1, 0, 0, 0]
        for i, qpos_idx in enumerate(self.joint_qpos_indices):
            self.data.qpos[qpos_idx] = self.default_pose[i]
        self.data.ctrl[:] = self.default_pose
        self.last_action = np.zeros(self.n_joints, dtype=np.float32)
        mujoco.mj_forward(self.model, self.data)

    # -- observations (exact upstream layout) --------------------------------
    def _base_ang_vel(self) -> np.ndarray:
        adr = self.model.sensor_adr[self.imu_ang_vel_id]
        return self.data.sensordata[adr:adr + 3].copy().astype(np.float32)

    def _projected_gravity(self) -> np.ndarray:
        quat = self.data.xquat[self.trunk_base_id].copy().astype(np.float32)
        world_gravity = np.array([0.0, 0.0, -1.0], dtype=np.float32)
        return quat_rotate_inverse(quat, world_gravity)

    def _joint_pos_rel(self) -> np.ndarray:
        pos = self.data.qpos[self.joint_qpos_indices].copy().astype(np.float32)
        return pos - self.default_pose

    def _joint_vel(self) -> np.ndarray:
        return self.data.qvel[self.joint_qvel_indices].copy().astype(np.float32)

    def get_observation(self, command: np.ndarray) -> np.ndarray:
        obs = [
            self._base_ang_vel(),
            self._projected_gravity(),
            self._joint_pos_rel(),
            self._joint_vel(),
            self.last_action,
        ]
        if self.use_13d:
            cmd = np.zeros(13, dtype=np.float32)
            cmd[: len(command)] = command
        else:
            cmd = np.asarray(command, dtype=np.float32)[:3]
        obs.append(cmd)
        return np.concatenate(obs).astype(np.float32)

    # -- stepping ------------------------------------------------------------
    def infer(self, command: np.ndarray) -> np.ndarray:
        obs = self.get_observation(command).reshape(1, -1)
        action = self.session.run([self.output_name], {self.input_name: obs})[0]
        action = action.squeeze(0).astype(np.float32)
        self.last_action = action.copy()
        return action

    def apply_action(self, action: np.ndarray) -> None:
        self.data.ctrl[:] = self.default_pose + action * self.action_scale

    def step_control(self, t: float, command: np.ndarray) -> StepSample:
        """One 50 Hz control step: infer, then DECIMATION physics substeps."""
        action = self.infer(command)
        self.apply_action(action)
        for _ in range(DECIMATION):
            mujoco.mj_step(self.model, self.data)
        quat = self.data.xquat[self.trunk_base_id].astype(np.float32)
        uz = float(quat_rotate_inverse(quat, np.array([0, 0, -1], np.float32))[2])
        return StepSample(
            t=t,
            command=np.asarray(command, dtype=np.float32).copy(),
            action=action.copy(),
            trunk_height=float(self.data.qpos[self._trunk_qpos_adr + 2]),
            trunk_pos=self.data.qpos[self._trunk_qpos_adr:self._trunk_qpos_adr + 3].copy(),
            upright_z=uz,
            lin_vel_world=self.data.qvel[self._trunk_qvel_adr:self._trunk_qvel_adr + 3].copy(),
        )

    def rollout(self, command_fn, duration_s: float, frame_hook=None) -> RolloutResult:
        """Run a rollout; `frame_hook(k, sample)` fires after every control step."""
        result = RolloutResult(obs_dim=self.obs_dim, use_13d=self.use_13d)
        n_steps = int(round(duration_s * 50))
        for k in range(n_steps):
            t = k / 50.0
            command = command_fn(t)
            if not self.use_13d:
                command = command[:3]
            sample = self.step_control(t, command)
            result.samples.append(sample)
            if frame_hook is not None:
                frame_hook(k, sample)
        result.control_steps = n_steps
        result.sim_steps = n_steps * DECIMATION
        result.duration_s = n_steps / 50.0
        return result
