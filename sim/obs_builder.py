#!/usr/bin/env python3
"""
61-D actor observation builder for MicroDuck locomotion policies.

Replicates the mjlab training obs layout without the torch/mjlab stack,
using raw MuJoCo (mujoco.MjModel / MjData) + numpy. Source contract is
documented in sim/OBS-CONTRACT.md and derived from:

  mjlab/tasks/velocity/velocity_env_cfg.py:70-108  (8 base terms)
  src/mjlab_microduck/robot/microduck_velocity_env_cfg.py:529-701  (delete base_lin_vel/height_scan, add head/body commands, filter passive_*)
  src/mjlab_microduck/robot/microduck_constants.py:78-109  (HOME_FRAME DEFAULT_QPOS)
  mjlab/envs/mdp/observations.py:26-91  (term func definitions)
  mjlab/entity/data.py:584-602  (projected_gravity_b, root_link_ang_vel_b via quat_apply_inverse)

Layout (61 floats, C-order, float32):
  0-2   base_ang_vel          (3)  body-frame gyro
  3-5   projected_gravity     (3)  gravity in body frame
  6-19  joint_pos_rel         (14) servo qpos - DEFAULT_QPOS
 20-33  joint_vel_rel         (14) servo qvel (1-step lag optional)
 34-47  last_action           (14) previous action, clipped
 48-50  command twist         (3)  lin_x, lin_y, ang_z
 51-54  head_command          (4)  neck_pitch, head_pitch, head_yaw, head_roll deltas
 55-60  body_command          (6)  x,y,z,roll,pitch,yaw deltas

Usage:
  from sim.obs_builder import build_observation, DEFAULT_QPOS, ACTION_JOINT_NAMES
  obs = build_observation(model, data, last_action, command)
  # command = {"twist": np.array([0.2,0,0.5]), "head": np.zeros(4), "body": np.zeros(6)}
  # or flat array of 13 values will be split.

Notes on fidelity vs training DR:
  - Training adds delay (joint_vel 1-step, IMU 0-1 step) and noise (gyro ±0.03, gravity ±0.01, joint_pos ±0.001, joint_vel ±0.25) and
    optional per-env IMU misalignment + encoder bias. This builder returns clean, instantaneous values — deterministic for sim verification.
    A history buffer for joint_vel lag can be enabled via ObsBuilder class.
  - USE_PROJECTED_GRAVITY=True in the pinned vel cfg; raw_accelerometer path (sensor imu_accel) is not used. Builder uses quat method matching
    asset.data.projected_gravity_b, which is equivalent to -column2 of rotation matrix for [0,0,-1] gravity.
"""

from __future__ import annotations

import numpy as np

try:
    import mujoco  # type: ignore
except ImportError:
    mujoco = None  # allow import without mujoco for contract inspection

# ---------------------------------------------------------------------------
# HOME / default joint positions (14, actuator order)
# Resolved from HOME_FRAME in src/mjlab_microduck/robot/microduck_constants.py:78
# Order = XML declaration order filtered of passive_* (robot_walk.xml:8-35)
# ---------------------------------------------------------------------------
ACTION_JOINT_NAMES: list[str] = [
    "left_hip_yaw",
    "left_hip_roll",
    "left_hip_pitch",
    "left_knee",
    "left_ankle",
    "neck_pitch",
    "head_pitch",
    "head_yaw",
    "head_roll",
    "right_hip_yaw",
    "right_hip_roll",
    "right_hip_pitch",
    "right_knee",
    "right_ankle",
]

# HOME pose values in same order (see microduck_constants.py:78-109)
# left_hip_yaw 0.0, left_hip_roll -0.0873 (-5deg), left_hip_pitch -0.4579, left_knee -0.0049, left_ankle 0.4530,
# neck_pitch 0.3491 (20deg), head_pitch 0.3491 (20deg), head_yaw 0, head_roll 0,
# right_hip_yaw 0.0, right_hip_roll 0.0873, right_hip_pitch 0.4579, right_knee 0.0049, right_ankle -0.4530
DEFAULT_QPOS: np.ndarray = np.array(
    [0.0, -0.0873, -0.4579, -0.0049, 0.4530, 0.3491, 0.3491, 0.0, 0.0, 0.0, 0.0873, 0.4579, 0.0049, -0.4530],
    dtype=np.float32,
)

# For convenience, qpos addresses per model are discovered dynamically (see _servo_ids).
# Static reference for the base walk model (qposadr 7-20):
ACTION_QPOSADR_WALK = list(range(7, 21))
# For rollers: [7,8,9,10,11,14,15,16,17,18,19,20,21,22]
# For backlash: [7,9,11,13,15,17,19,21,23,25,27,29,31,33]

OBS_DIM = 61
ACTION_DIM = 14

# ---------------------------------------------------------------------------
# Quaternion helpers (numpy port of mjlab.utils.lab_api.math.quat_apply_inverse)
# MuJoCo quat is [w, x, y, z]; mjlab torch version operates batch-first.
# ---------------------------------------------------------------------------

def quat_apply_inverse_numpy(quat_wxyz: np.ndarray, vec: np.ndarray) -> np.ndarray:
    """Rotate vec by inverse of quat (quat is unit, wxyz). vec shape (3,) or (...,3)."""
    # q* = [w, -x, -y, -z] ; v' = q* * v * q  (as pure quaternion)
    # Optimized formula: v' = v + 2 * cross(q_vec, cross(q_vec, v) + w * v)
    # For inverse, negate q_vec or swap cross order. We use q* path.
    w, x, y, z = quat_wxyz[..., 0], quat_wxyz[..., 1], quat_wxyz[..., 2], quat_wxyz[..., 3]
    q_vec = np.stack([x, y, z], axis=-1)  # (...,3)
    # t = 2 * cross(q_vec, vec)
    # For inverse: cross(q*, v) = cross(-q_vec, v) = -cross(q_vec, v)
    # So compute with -q_vec:
    # Instead implement standard quat_apply_inverse as in mjlab:
    # quat_apply_inverse(q, v) = quat_apply(q_conj, v)
    # with q_conj = [w, -x, -y, -z]
    q_conj_vec = -q_vec
    # cross1 = cross(q_conj_vec, vec)
    cross1 = np.cross(q_conj_vec, vec)
    # cross2 = cross(q_conj_vec, cross1 + w*vec)
    w_exp = w[..., None] if w.ndim > 0 else w
    # Handle broadcasting: vec shape (...,3)
    tmp = cross1 + w_exp * vec if vec.ndim == q_conj_vec.ndim else cross1 + w * vec
    cross2 = np.cross(q_conj_vec, tmp)
    return vec + 2.0 * cross2


def projected_gravity_from_quat(root_quat_wxyz: np.ndarray) -> np.ndarray:
    """Gravity [0,0,-1] in body frame: quat_apply_inverse(root_quat, [0,0,-1])."""
    # Use normalized gravity; mjlab uses gravity_vec_w which is normalized or [0,0,-9.81] but projected_gravity_b is derived from gravity_vec_w then normalized? In data.py:584 it's quat_apply_inverse(root_quat, gravity_vec_w). gravity_vec_w is [0,0,-9.81] but the builder normalizes via direction only.
    # We follow mjlab's derived property which ends up unit-ish: for upright, returns [0,0,-1].
    g_w = np.array([0.0, 0.0, -1.0], dtype=np.float64)
    return quat_apply_inverse_numpy(root_quat_wxyz, g_w).astype(np.float32)


def root_ang_vel_b_from_data(model, data) -> np.ndarray:
    """
    Body-frame angular velocity. Prefers gyro sensor `imu_ang_vel` if present
    (sensordata[7:10]), else falls back to qvel[3:6] rotated by inverse quat.
    Both are body-frame per mjlab's root_link_ang_vel_b.
    """
    if model is None or mujoco is None:
        raise RuntimeError("MuJoCo model is required to build an observation")

    # Prefer the gyro sensor (more direct, matches the noise-free sim path).
    for i in range(model.nsensor):
        name = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_SENSOR, i)
        if name == "imu_ang_vel":
            adr = int(model.sensor_adr[i])
            dim = int(model.sensor_dim[i])
            if dim != 3:
                raise ValueError(f"imu_ang_vel must have dimension 3, got {dim}")
            value = np.asarray(data.sensordata[adr : adr + dim], dtype=np.float32)
            if value.shape != (3,) or not np.all(np.isfinite(value)):
                raise ValueError("imu_ang_vel contains invalid values")
            return value

    # The pinned MJCFs do not all expose a gyro. In that explicit case derive
    # the same body-frame quantity from the free-joint velocity.
    # qpos: [x,y,z, qw,qx,qy,qz, joints...]; qvel: [vx,vy,vz, wx,wy,wz, joint_vel...]
    # root quat is qpos[3:7] as [w,x,y,z]; root ang vel world is qvel[3:6]
    quat = np.asarray(data.qpos[3:7], dtype=np.float64)  # w,x,y,z
    ang_w = np.asarray(data.qvel[3:6], dtype=np.float64)
    if quat.shape != (4,) or ang_w.shape != (3,):
        raise ValueError("model must expose a free joint for angular velocity")
    ang_b = quat_apply_inverse_numpy(quat, ang_w).astype(np.float32)
    if not np.all(np.isfinite(ang_b)):
        raise ValueError("derived angular velocity contains invalid values")
    return ang_b


# ---------------------------------------------------------------------------
# Joint discovery helpers
# ---------------------------------------------------------------------------

def _servo_joint_info(model) -> tuple[list[int], list[int], list[str]]:
    """
    Returns (qpos_addrs, dof_addrs, names) for the 14 servo joints.
    Filters any joint whose name starts with passive_.
    Order is the XML declaration order (which matches ACTION_JOINT_NAMES for base models).
    """
    if model is None or mujoco is None:
        raise RuntimeError("MuJoCo model is required to discover servo joints")

    qpos_addrs: list[int] = []
    dof_addrs: list[int] = []
    names: list[str] = []
    for i in range(model.njnt):
        name = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_JOINT, i)
        if name is None:
            continue
        if model.jnt_type[i] == mujoco.mjtJoint.mjJNT_FREE:
            continue  # skip free joint
        if name.startswith("passive_"):
            continue
        qpos_addrs.append(int(model.jnt_qposadr[i]))
        dof_addrs.append(int(model.jnt_dofadr[i]))
        names.append(name)
    if len(names) != ACTION_DIM or set(names) != set(ACTION_JOINT_NAMES):
        raise ValueError(
            f"expected exactly the {ACTION_DIM} canonical servo joints, got {names}"
        )

    # Return canonical policy order even when a model interleaves passive
    # backlash/wheel joints between the actuated joints.
    by_name = {
        name: (qpos, dof)
        for name, qpos, dof in zip(names, qpos_addrs, dof_addrs)
    }
    ordered = [by_name[name] for name in ACTION_JOINT_NAMES]
    return [item[0] for item in ordered], [item[1] for item in ordered], ACTION_JOINT_NAMES


# ---------------------------------------------------------------------------
# Core builder
# ---------------------------------------------------------------------------

def _normalize_command(command) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """
    Accepts command as dict {"twist": (3,), "head": (4,), "body": (6,)} or flat array 13.
    Returns (twist3, head4, body6) as float32 arrays.
    """
    def exact(value, size: int, label: str) -> np.ndarray:
        result = np.asarray(value, dtype=np.float32).reshape(-1)
        if result.size != size:
            raise ValueError(f"{label} must have {size} values, got {result.size}")
        if not np.all(np.isfinite(result)):
            raise ValueError(f"{label} contains non-finite values")
        return result

    if isinstance(command, dict):
        twist = exact(command.get("twist", np.zeros(3)), 3, "twist")
        head = exact(command.get("head", command.get("head_command", np.zeros(4))), 4, "head")
        body = exact(command.get("body", command.get("body_command", np.zeros(6))), 6, "body")
        return twist, head, body

    arr = exact(command, 13, "command")
    return arr[0:3], arr[3:7], arr[7:13]


def build_observation(
    model,
    data,
    last_action: np.ndarray | None = None,
    command: dict | np.ndarray | None = None,
    *,
    joint_vel_history: np.ndarray | None = None,
) -> np.ndarray:
    """
    Build 61-D observation from MuJoCo model/data snapshot.

    Args:
        model: mujoco.MjModel
        data: mujoco.MjData (after mj_step / mj_forward)
        last_action: (14,) float32 previous action (will be clipped internal). If None, zeros.
        command: dict with twist/head/body or flat 13 array. If None, zeros (standing).
        joint_vel_history: optional (14,) previous joint_vel_relevant for 1-step lag emulation.
                           If provided, returned joint_vel term will be this history value
                           and caller should update history with current joint_vel after call.

    Returns:
        (61,) float32 obs
    """
    # 1. base_ang_vel (3)
    base_ang_vel = root_ang_vel_b_from_data(model, data)  # (3,)

    # 2. projected_gravity (3)
    # root quat from free joint qpos[3:7] as [w,x,y,z]
    quat = np.asarray(data.qpos[3:7], dtype=np.float64)  # w,x,y,z
    if quat.shape != (4,):
        raise ValueError("model must expose a free-joint quaternion")
    # Ensure normalized (MuJoCo keeps normalized)
    n = np.linalg.norm(quat)
    if n <= 1e-8:
        raise ValueError("free-joint quaternion is zero")
    proj_grav = projected_gravity_from_quat(quat / n)  # (3,)

    # 3. joint_pos_rel (14) and 4. joint_vel_rel (14)
    qpos_addrs, dof_addrs, servo_names = _servo_joint_info(model)
    if servo_names != ACTION_JOINT_NAMES:
        raise ValueError(f"unexpected servo order: {servo_names}")
    qpos_servo = np.asarray([data.qpos[a] for a in qpos_addrs], dtype=np.float32)
    qvel_servo = np.asarray([data.qvel[d] for d in dof_addrs], dtype=np.float32)
    default_servo = DEFAULT_QPOS

    joint_pos_rel = qpos_servo - default_servo  # (14,)
    joint_vel_rel = qvel_servo  # default_joint_vel is 0; mjlab subtracts 0

    if joint_vel_history is not None:
        # emulate 1-step lag: output history, not current
        lagged = np.asarray(joint_vel_history, dtype=np.float32).reshape(14)
        joint_vel_rel = lagged

    # 5. last_action (14)
    if last_action is None:
        last_action_arr = np.zeros(14, dtype=np.float32)
    else:
        last_action_arr = np.asarray(last_action, dtype=np.float32).reshape(-1)
        if last_action_arr.size != ACTION_DIM:
            raise ValueError(f"last_action must have {ACTION_DIM} values, got {last_action_arr.size}")
        if not np.all(np.isfinite(last_action_arr)):
            raise ValueError("last_action contains non-finite values")

    # 6. commands 3+4+6
    if command is None:
        twist = np.zeros(3, dtype=np.float32)
        head = np.zeros(4, dtype=np.float32)
        body = np.zeros(6, dtype=np.float32)
    else:
        twist, head, body = _normalize_command(command)

    # Concatenate in training order
    obs = np.concatenate(
        [base_ang_vel, proj_grav, joint_pos_rel, joint_vel_rel, last_action_arr, twist, head, body]
    ).astype(np.float32)

    assert obs.shape == (61,), f"obs shape {obs.shape} != (61,)"
    return obs


class ObsBuilder:
    """
    Stateful helper that maintains joint_vel 1-step history and last_action
    across rollout steps for fully faithful DR lag emulation. For sim verification
    you can also use the stateless `build_observation` (lag not critical).
    """

    def __init__(self, model):
        self.model = model
        _, _, names = _servo_joint_info(model)
        self.servo_names = names
        self.prev_joint_vel = np.zeros(14, dtype=np.float32)
        self.last_action = np.zeros(14, dtype=np.float32)

    def reset(self):
        self.prev_joint_vel[:] = 0
        self.last_action[:] = 0

    def step(self, data, command=None) -> np.ndarray:
        # Build with lagged joint_vel
        obs = build_observation(
            self.model, data, last_action=self.last_action, command=command, joint_vel_history=self.prev_joint_vel
        )
        # Update history with CURRENT joint_vel (for next step)
        _, dof_addrs, servo_names = _servo_joint_info(self.model)
        # gather current qvel in canonical order
        if servo_names != ACTION_JOINT_NAMES:
            name_to_dof = {n: d for n, d in zip(servo_names, dof_addrs)}
            cur_vel = np.array([data.qvel[name_to_dof[n]] for n in ACTION_JOINT_NAMES], dtype=np.float32)
        else:
            cur_vel = np.array([data.qvel[d] for d in dof_addrs], dtype=np.float32)
        self.prev_joint_vel[:] = cur_vel
        return obs

    def update_last_action(self, action: np.ndarray):
        value = np.asarray(action, dtype=np.float32).reshape(-1)
        if value.size != ACTION_DIM or not np.all(np.isfinite(value)):
            raise ValueError(f"action must be finite and have {ACTION_DIM} values")
        self.last_action[:] = value


# Convenience for tests
def get_default_qpos_dict() -> dict[str, float]:
    return {n: float(v) for n, v in zip(ACTION_JOINT_NAMES, DEFAULT_QPOS)}
