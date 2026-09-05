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
    ACTION_DIM,
    ACTION_SCALE,
    DECIMATION,
    DEFAULT_POSE,
    INITIAL_TRUNK_Z,
    OBSERVATION_DIM,
    TIMESTEP,
    TRUNK_BODY,
    TRUNK_FREEJOINT,
    IMU_GYRO_SENSOR,
    quat_rotate_inverse,
)

# The stage is visual styling around the unchanged robot and physical floor.
# The backdrop has collisions disabled so it cannot affect a rollout.
_SCENE_ASSET_XML = """
    <texture name="ci_floor_grid" type="2d" builtin="checker"
             width="256" height="256"
             rgb1="0.07 0.13 0.22" rgb2="0.11 0.21 0.33"/>
    <material name="ci_floor_grid_material" texture="ci_floor_grid"
              texrepeat="8 8" reflectance="0.04"/>
    <material name="ci_backdrop_material" rgba="0.025 0.045 0.09 1"/>
"""

# Floor + lights injected into the vendored MJCF (which is robot-only).
_FLOOR_XML = """
  <light name="ci_key" directional="true" pos="0 -3 3" dir="0 0.5 -0.8660254" diffuse="0.55 0.62 0.78" ambient="0.18 0.22 0.30" castshadow="true"/>
  <light name="ci_fill" directional="true" pos="-2 -2 2" dir="0.7 0.7 -0.6" diffuse="0.22 0.32 0.5" ambient="0 0 0" castshadow="false"/>
  <geom name="ci_floor" type="plane" size="8 8 0.05" material="ci_floor_grid_material" condim="3" friction="1.0 0.005 0.0001"/>
  <geom name="ci_backdrop" type="plane" pos="0 4 2" euler="1.5708 0 0" size="8 4 0.05" material="ci_backdrop_material" contype="0" conaffinity="0"/>
"""


def load_model(mjcf_path: str | Path) -> mujoco.MjModel:
    """Load the Microduck MJCF with the runtime's timestep and CI floor."""
    mjcf_path = Path(mjcf_path).resolve()
    xml = mjcf_path.read_text()
    # Add the showcase stage materials to the model's existing asset section.
    asset_idx = xml.index("</asset>")
    xml = xml[:asset_idx] + _SCENE_ASSET_XML + xml[asset_idx:]
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
    # The decorative stage expands MuJoCo's compiled bounds, which makes a
    # directional light spend its shadow-map resolution over empty space.
    # Keep render statistics centered on the moving duck; this affects only
    # visualization clipping and shadow quality, not physics.
    model.stat.center[:] = [0.0, 0.0, 0.2]
    model.stat.extent = 1.5
    model.vis.map.shadowclip = 0.75
    model.vis.quality.offsamples = 8
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
    left_foot_contact: bool
    right_foot_contact: bool


@dataclass
class RolloutResult:
    samples: list = field(default_factory=list)
    obs_dim: int = 0
    use_13d: bool = True
    control_steps: int = 0
    sim_steps: int = 0
    duration_s: float = 0.0
    initial_left_foot_contact: bool = False
    initial_right_foot_contact: bool = False

    def metrics(self) -> dict:
        h = np.array([s.trunk_height for s in self.samples])
        uz = np.array([s.upright_z for s in self.samples])
        xy = np.array([s.trunk_pos[:2] for s in self.samples])
        acts = np.array([s.action for s in self.samples])
        supported = np.array([
            s.left_foot_contact or s.right_foot_contact for s in self.samples
        ], dtype=bool)
        both_supported = np.array([
            s.left_foot_contact and s.right_foot_contact for s in self.samples
        ], dtype=bool)
        finite = bool(np.isfinite(acts).all() and np.isfinite(h).all())
        initially_supported = bool(
            self.initial_left_foot_contact or self.initial_right_foot_contact
        )
        takeoff_index = None
        support_seen = initially_supported
        for index, is_supported in enumerate(supported):
            if support_seen and not is_supported:
                takeoff_index = index
                break
            support_seen = support_seen or bool(is_supported)
        airborne_after_support = takeoff_index is not None
        touchdown_after_takeoff = False
        if takeoff_index is not None:
            touchdown_after_takeoff = bool(np.any(both_supported[takeoff_index + 1:]))
        # Unilateral support is reported as an observation for one-foot
        # diagnostics (e.g. Flamingo). It is not a pass/fail task-success
        # claim: contact chatter in MuJoCo makes short intervals noisy, and no
        # threshold here certifies that the commanded leg actually lifted.
        unilateral = np.array([
            bool(s.left_foot_contact) != bool(s.right_foot_contact) for s in self.samples
        ], dtype=bool)
        dt = float(self.duration_s / max(1, len(self.samples)))
        max_unilateral_s = 0.0
        run = 0.0
        for flag in unilateral:
            run = run + dt if flag else 0.0
            max_unilateral_s = max(max_unilateral_s, run)
        return {
            "duration_s": round(self.duration_s, 3),
            "control_steps": self.control_steps,
            "obs_dim": self.obs_dim,
            "command_dim": 13 if self.use_13d else 3,
            "min_trunk_height_m": round(float(h.min()), 4),
            "max_trunk_height_m": round(float(h.max()), 4),
            "final_trunk_height_m": round(float(h[-1]), 4),
            "max_tilt_deg": round(float(np.degrees(np.arccos(np.clip(-uz.max(), -1, 1)))), 2),
            "final_tilt_deg": round(float(np.degrees(np.arccos(np.clip(-uz[-1], -1, 1)))), 2),
            "path_length_m": round(float(np.linalg.norm(np.diff(xy, axis=0), axis=1).sum()), 3),
            "displacement_m": round(float(np.linalg.norm(xy[-1] - xy[0])), 3),
            "max_abs_action": round(float(np.abs(acts).max()), 4),
            "all_finite": finite,
            "initial_foot_contact": initially_supported,
            "initial_bilateral_contact": bool(
                self.initial_left_foot_contact and self.initial_right_foot_contact
            ),
            "airborne_observed": bool(np.any(~supported)),
            "takeoff_after_support": airborne_after_support,
            "touchdown_after_takeoff": touchdown_after_takeoff,
            "unilateral_supported": bool(np.any(unilateral)),
            "unilateral_fraction": round(float(unilateral.mean()) if len(unilateral) else 0.0, 4),
            "max_unilateral_interval_s": round(float(max_unilateral_s), 3),
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
        out_shape = self.session.get_outputs()[0].shape
        input_dim = in_shape[-1] if in_shape and isinstance(in_shape[-1], int) else None
        output_dim = out_shape[-1] if out_shape and isinstance(out_shape[-1], int) else None
        if input_dim != OBSERVATION_DIM:
            raise ValueError(f"Policy expects {in_shape}; expected {OBSERVATION_DIM} obs dims")
        if output_dim != ACTION_DIM:
            raise ValueError(f"Policy returns {out_shape}; expected {ACTION_DIM} actions")
        self.use_13d = True
        self.obs_dim = OBSERVATION_DIM

        self.imu_ang_vel_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_SENSOR,
                                                IMU_GYRO_SENSOR)
        if self.imu_ang_vel_id < 0:
            raise ValueError("Sensor 'imu_ang_vel' missing from MJCF")
        self.trunk_base_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, TRUNK_BODY)
        self.floor_geom_id = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_GEOM, "ci_floor")
        self.left_foot_geom_ids = self._find_foot_contact_geoms(
            "left_foot_collision", "ankle_l_v1"
        )
        self.right_foot_geom_ids = self._find_foot_contact_geoms(
            "right_foot_collision", "ankle_r_v1"
        )
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

    def prepare_start(self, start: dict) -> None:
        """Apply one bounded, registry-owned initial-state preset."""
        self.reset()
        preset = start["preset"]
        if preset == "standing_pose":
            return
        if preset == "settled_standing":
            settle_s = float(start.get("settle_s", 0.2))
            for _ in range(int(round(settle_s / self.model.opt.timestep))):
                mujoco.mj_step(self.model, self.data)
            self.last_action[:] = 0
            return
        if preset != "airborne_drop":
            raise ValueError(f"unsupported start preset: {preset}")

        adr = self._trunk_qpos_adr
        velocity_adr = self._trunk_qvel_adr
        self.data.qpos[adr + 2] = float(start["trunk_height_m"])
        root_half = np.sqrt(0.5)
        orientations = {
            "upright": [1.0, 0.0, 0.0, 0.0],
            "front": [root_half, 0.0, root_half, 0.0],
            "back": [root_half, 0.0, -root_half, 0.0],
            "left": [root_half, root_half, 0.0, 0.0],
            "right": [root_half, -root_half, 0.0, 0.0],
        }
        self.data.qpos[adr + 3:adr + 7] = orientations[start["orientation"]]
        self.data.qvel[velocity_adr:velocity_adr + 3] = np.asarray(
            start.get("linear_velocity_mps", [0.0, 0.0, 0.0]), dtype=float
        )
        mujoco.mj_forward(self.model, self.data)

    def _find_foot_contact_geoms(self, geom_name: str, body_name: str) -> set[int]:
        """Find the floor-contact geoms for standard feet or roller wheels."""
        geom_id = mujoco.mj_name2id(self.model, mujoco.mjtObj.mjOBJ_GEOM, geom_name)
        if geom_id >= 0:
            return {int(geom_id)}

        body_id = mujoco.mj_name2id(self.model, mujoco.mjtObj.mjOBJ_BODY, body_name)
        if body_id < 0:
            raise ValueError(
                f"model is missing {geom_name!r} and fallback body {body_name!r}"
            )

        contact_geoms = set()
        for candidate, candidate_body in enumerate(self.model.geom_bodyid):
            if (
                self.model.geom_contype[candidate] == 0
                and self.model.geom_conaffinity[candidate] == 0
            ):
                continue
            current = int(candidate_body)
            while current > 0:
                if current == body_id:
                    contact_geoms.add(candidate)
                    break
                current = int(self.model.body_parentid[current])

        if not contact_geoms:
            raise ValueError(f"model has no contact geoms under {body_name!r}")
        return contact_geoms

    def foot_contacts(self) -> tuple[bool, bool]:
        """Return whether each foot or roller wheel currently touches the floor."""
        left = right = False
        for index in range(self.data.ncon):
            contact = self.data.contact[index]
            pair = {int(contact.geom1), int(contact.geom2)}
            if self.floor_geom_id not in pair:
                continue
            left = left or bool(self.left_foot_geom_ids.intersection(pair))
            right = right or bool(self.right_foot_geom_ids.intersection(pair))
        return left, right

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
        left_contact, right_contact = self.foot_contacts()
        return StepSample(
            t=t,
            command=np.asarray(command, dtype=np.float32).copy(),
            action=action.copy(),
            trunk_height=float(self.data.qpos[self._trunk_qpos_adr + 2]),
            trunk_pos=self.data.qpos[self._trunk_qpos_adr:self._trunk_qpos_adr + 3].copy(),
            upright_z=uz,
            lin_vel_world=self.data.qvel[self._trunk_qvel_adr:self._trunk_qvel_adr + 3].copy(),
            left_foot_contact=left_contact,
            right_foot_contact=right_contact,
        )

    def rollout(self, command_fn, duration_s: float, frame_hook=None) -> RolloutResult:
        """Run a rollout; `frame_hook(k, sample)` fires after every control step."""
        result = RolloutResult(obs_dim=self.obs_dim, use_13d=self.use_13d)
        initial_left, initial_right = self.foot_contacts()
        result.initial_left_foot_contact = initial_left
        result.initial_right_foot_contact = initial_right
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
