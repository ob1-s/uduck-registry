# 🦆 uDuck Registry

> **Community behaviors for MicroDuck** · A lightweight, discoverable index for neural policies, training environments, and physical artifacts.

[![CI](https://github.com/uduck-registry/uduck-registry/actions/workflows/ci.yml/badge.svg)](https://github.com/uduck-registry/uduck-registry/actions)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Contract: 61D Obs / 50Hz](https://img.shields.io/badge/Contract-61D%20Obs%20%2F%2050Hz-amber.svg)](#contract-specification)

---

## What is uDuck Registry?

**uDuck Registry** is an open, community-first discovery catalog for the **[MicroDuck](https://github.com/pollen-robotics/microduck)** bipedal robotics platform developed by [Pollen Robotics](https://pollen-robotics.com) (a subsidiary of Hugging Face). 

MicroDuck is a ~800g, 25cm biped robot that runs neural reinforcement learning policies at 50 Hz on an onboard Rockchip RK3566 SBC. As researchers and enthusiasts train new walking gaits, fall recovery reflexes, acrobatic somersaults, and roller skating behaviors, finding and running them on physical hardware should be effortless.

Inspired by shadcn-style component registries, **uDuck makes the MicroDuck ecosystem immediately discoverable without duplicating upstream infrastructure**:
* **Thin index over canonical truth**: We point directly to upstream Hugging Face Spaces, GitHub releases, and training repos rather than re-hosting multi-megabyte ONNX files.
* **Strict physical contracts**: Every behavior indexes its exact observation contract (61-D), joint actuation mapping (14 Dynamixel XL330 servos), and BAM actuator model requirements.
* **Uncompromising verification semantics**: Badges distinguish behaviors tested and filmed on real physical MicroDuck hardware from simulation-only checkpoints.
* **Drop-in deployment**: Copy-paste snippets directly into `/etc/robot/robotd.toml` to hot-swap gaits on your robot in seconds.

---

## Verification Semantics

Because these policies control physical hardware with real actuators and batteries, uDuck establishes strict verification tiers:

| Status | Badge | Meaning |
|---|---|---|
| **Verified Hardware** | ![Verified Hardware](https://img.shields.io/badge/Status-Verified_Hardware-emerald) | Confirmed executed on physical MicroDuck hardware with recorded video proof or public hardware release. |
| **Claimed Hardware** | ![Claimed Hardware](https://img.shields.io/badge/Status-Claimed_Hardware-amber) | Author reports successful physical robot deployment; independent community verification pending. |
| **Simulation Tested** | ![Simulation Tested](https://img.shields.io/badge/Status-Simulation_Tested-cyan) | Trained and verified in MuJoCo / `mjlab` simulation across thousands of parallel environments with BAM actuator physics. |
| **Experimental** | ![Experimental](https://img.shields.io/badge/Status-Experimental-purple) | Community work-in-progress, new embodiment variation, or conceptual gait. |

---

## The MicroDuck Contract

All policies indexed in uDuck adhere to the unified ecosystem standard:

- **Observation Vector (61-D)**:
  - Proprioception (48-D): Measured joint positions (14), velocities (14), previous actions (14), projected gravity vector (3), gyro angular rate (3). Reads through mechanical backlash.
  - Twist Command (3-D): Operator intent `[vx, vy, yaw_rate]`.
  - Head Pose Command (4-D): Active neck/head target orientations `[neck_pitch, head_pitch, head_yaw, head_roll]`.
  - Body Pose Command (6-D): Torso 6-DOF offset `[tx, ty, tz, roll, pitch, yaw]`.
- **Action Vector (14 Servos)**:
  - Left Leg (0–4): `hip_yaw`, `hip_roll`, `hip_pitch`, `knee`, `ankle`.
  - Neck & Head (5–8): `neck_pitch`, `head_pitch`, `head_yaw`, `head_roll`.
  - Right Leg (9–13): `hip_yaw`, `hip_roll`, `hip_pitch`, `knee`, `ankle`.
- **Control Frequency**: 50 Hz (0.005s MuJoCo timestep × 4 decimation).
- **Actuator Physics**: Dynamixel XL330 modeled via Rhoban BAM M6 voltage control law, back-EMF, and dynamic voltage sag.

---

## Seeded Behaviors

uDuck Registry ships populated with 16 legitimate behaviors:

1. `alpha-walking` — **Alpha Dynamic Walk** *(Pollen Robotics · Verified Hardware)*
2. `fall-recovery` — **Dynamic Fall Recovery** *(Pollen Robotics · Verified Hardware)*
3. `ground-pick` — **Autonomous Ground Pick** *(Pollen Robotics · Verified Hardware)*
4. `sit-stand` — **Smooth Sit ↔ Stand** *(Pollen Robotics · Verified Hardware)*
5. `roulade` — **Acrobatic Roulade (Forward Roll)** *(Pollen Robotics · Verified Hardware)*
6. `ball-kick-left` — **Impulse Ball Kick (Left Foot)** *(Pollen Robotics · Verified Hardware)*
7. `ball-kick-right` — **Impulse Ball Kick (Right Foot)** *(Pollen Robotics · Verified Hardware)*
8. `roller-drive` — **Roller Skate Velocity Drive** *(Pollen Robotics · Verified Hardware)*
9. `roller-crouch` — **Roller Blade Crouch Glide** *(Pollen Robotics · Verified Hardware)*
10. `roller-swizzle` — **Classic Swizzle Skating** *(Pollen Robotics · Sim Tested)*
11. `roller-slope` — **Roller Slope Descent** *(Pollen Robotics · Sim Tested)*
12. `spin-in-place` — **In-Place Roller Spin** *(Pollen Robotics · Sim Tested)*
13. `rough-terrain-walk` — **Rough Terrain Adaptive Gait** *(Pollen Robotics · Sim Tested)*
14. `backlash-walking` — **Backlash-Compensated Walking** *(Pollen Robotics · Sim Tested)*
15. `waddle-locomotion` — **Waddle Custom Locomotion** *(Nick Koenig · Sim Tested)*
16. `standing-body-control` — **Standing 6-DOF Body Pose Controller** *(Tommy Zihao · Claimed Hardware)*

---

## Machine-Readable Access

The entire registry is accessible via simple HTTP GET requests without an API key:

```bash
# Fetch complete catalog JSON
curl -s https://uduck.dev/registry.json | jq .

# Fetch single behavior manifest
curl -s https://uduck.dev/api/behaviors/alpha-walking | jq .
```

---

## Quickstart & CLI

```bash
# Clone the repository
git clone https://github.com/uduck-registry/uduck-registry.git
cd uduck-registry

# Install dependencies
pnpm install

# Run automated schema and contract validation
pnpm validate

# Run unit tests
pnpm test

# Launch local exploration UI
pnpm dev

# Use the uDuck CLI
pnpm cli list
pnpm cli info alpha-walking
pnpm cli toml alpha-walking
```

---

## Deploying a Policy to your MicroDuck

To run any policy from the registry on your MicroDuck:

1. **Pull the ONNX model to the robot:**
   ```bash
   curl -L "https://huggingface.co/spaces/pollen-robotics/microduck-simulator/resolve/main/app/public/policies/BEST_alpha_walking.onnx" -o "/opt/robot/policies/BEST_alpha_walking.onnx"
   ```

2. **Add to `/etc/robot/robotd.toml`:**
   ```toml
   [policy]
   walk = "/opt/robot/policies/BEST_alpha_walking.onnx"
   ```

3. **Restart the onboard daemon:**
   ```bash
   sudo systemctl restart robotd
   robotctl health
   ```

---

## Contributing

We welcome community policies, gaits, environments, and tricks!

To add an entry:
1. Fork this repo.
2. Add a single JSON file: `registry/behaviors/<your-id>.json`.
3. Run `pnpm validate` and `pnpm test`.
4. Open a Pull Request.

Read the complete [Contribution Guide](CONTRIBUTING.md) for field specifications.

---

## Attribution & Disclaimer

* **uDuck Registry** is an independent, community-maintained project.
* **MicroDuck**, its CAD models, and official alpha policies are open-source creations of **[Pollen Robotics](https://pollen-robotics.com)** (a subsidiary of Hugging Face).
* uDuck Registry is not affiliated with, maintained by, or endorsed by Pollen Robotics or Hugging Face.

## License

Apache License 2.0. See [LICENSE](LICENSE) for details.
