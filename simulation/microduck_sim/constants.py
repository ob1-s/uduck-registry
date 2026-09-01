"""Constants and helpers shared by the Microduck simulation runtime.

Every value here is lifted from the official upstream references and must not
be changed casually:

- DEFAULT_POSE, JOINT_NAMES, ACTION_SCALE, TIMESTEP, DECIMATION:
  `pollen-robotics/microduck_rl` `scripts/infer_policy.py` and the official
  `pollen-robotics/microduck-simulator` Hugging Face Space
  (`app/src/game/constants.js`), which agree exactly.
- Observation layout (61D, unified command mode):
  3 base angular velocity + 3 projected gravity + 14 joint pos (relative to
  the default pose) + 14 joint velocities + 14 last actions + 13 command.
  The legacy layout (51D) replaces the 13D command with the 3D twist command.
- Command (13D): twist (vx, vy, wz) + head offset (4) + body pose (6).
"""

from __future__ import annotations

import numpy as np

TIMESTEP = 0.005  # infer_policy.py overrides the MJCF's 0.002 with this.
DECIMATION = 4  # 4 * 0.005 s = 0.02 s -> 50 Hz control.
CONTROL_HZ = 50

JOINT_NAMES = [
    "left_hip_yaw", "left_hip_roll", "left_hip_pitch", "left_knee", "left_ankle",
    "neck_pitch", "head_pitch", "head_yaw", "head_roll",
    "right_hip_yaw", "right_hip_roll", "right_hip_pitch", "right_knee", "right_ankle",
]

# STAND2 pose (matches HOME_FRAME in microduck_constants.py).
DEFAULT_POSE = np.array([
    0.0,      # left_hip_yaw
    -0.0873,  # left_hip_roll
    -0.4579,  # left_hip_pitch
    -0.0049,  # left_knee
    0.4530,   # left_ankle
    0.3491,   # neck_pitch
    0.3491,   # head_pitch
    0.0,      # head_yaw
    0.0,      # head_roll
    0.0,      # right_hip_yaw
    0.0873,   # right_hip_roll
    0.4579,   # right_hip_pitch
    0.0049,   # right_knee
    -0.4530,  # right_ankle
], dtype=np.float32)

ACTION_SCALE = 1.0

# Initial trunk height of the freejoint (legs variant) from infer_policy.py.
INITIAL_TRUNK_Z = 0.125

# Velocity command envelope used by the official runtime (legs variant).
VEL_MAX_X = 0.3
VEL_MIN_X = -0.3
VEL_MAX_Y = 0.2
VEL_MIN_Y = -0.2
VEL_MAX_ANG = 1.5

# Trunk freejoint name in every Microduck MJCF variant.
TRUNK_FREEJOINT = "trunk_base_freejoint"
TRUNK_BODY = "trunk_base"
IMU_GYRO_SENSOR = "imu_ang_vel"


def quat_rotate_inverse(quat: np.ndarray, vec: np.ndarray) -> np.ndarray:
    """Rotate `vec` from world frame into the frame of `quat` (w, x, y, z)."""
    w, x, y, z = quat
    # Conjugate quaternion rotates world -> body.
    q_conj = np.array([w, -x, -y, -z], dtype=np.float32)
    # q * v * q^-1 expanded (t = 2 q_vec x v).
    q_vec = q_conj[1:]
    t = 2.0 * np.cross(q_vec, vec)
    return vec + w * t + np.cross(q_vec, t)
