# 🦆 uDuck Registry

> **Community behaviors for MicroDuck** · A lightweight, discoverable index for neural policies, training environments, and physical artifacts.

[![CI](https://github.com/ob1-s/uduck-registry/actions/workflows/ci.yml/badge.svg)](https://github.com/ob1-s/uduck-registry/actions)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Contract: 61D Obs / 50Hz](https://img.shields.io/badge/Contract-61D%20Obs%20%2F%2050Hz-amber.svg)](#contract-specification)

---

## What is uDuck Registry?

**uDuck Registry** is an open, community-first discovery catalog for the **[MicroDuck](https://github.com/pollen-robotics/microduck)** bipedal robotics platform developed by [Pollen Robotics](https://pollen-robotics.com) (a subsidiary of Hugging Face). 

MicroDuck is a ~800g, 25cm biped robot that runs neural reinforcement learning policies at 50 Hz on an onboard Rockchip RK3566 SBC. As researchers and enthusiasts train new walking gaits, fall recovery reflexes, acrobatic somersaults, and roller skating behaviors, finding and running them on physical hardware should be effortless.

Inspired by shadcn-style component registries, **uDuck makes the MicroDuck ecosystem immediately discoverable without duplicating upstream infrastructure**:
* **Small index over canonical truth**: Descriptors point to upstream Hugging Face Spaces, GitHub releases, and training repos. Verified artifacts record their SHA-256 and byte size; `vendor/policies/` is an optional local cache for offline work and simulation.
* **Strict physical contracts**: Every behavior indexes its exact observation contract (61-D), 14-joint policy action mapping, and BAM actuator model requirements. The separate beak actuator is outside the policy vector.
* **Uncompromising verification semantics**: Badges distinguish behaviors tested and filmed on real physical MicroDuck hardware from simulation-only checkpoints.
* **Drop-in deployment**: Copy-paste supported policy snippets into `/etc/robot/robotd.toml`, then restart `robotd`.

---

## Verification Semantics

Because these policies control physical hardware with real actuators and batteries, uDuck establishes strict verification tiers:

| Status | Badge | Meaning |
|---|---|---|
| **Verified Hardware** | ![Verified Hardware](https://img.shields.io/badge/Status-Verified_Hardware-emerald) | Confirmed executed on physical MicroDuck hardware with recorded video proof or public hardware release. |
| **Claimed Hardware** | ![Claimed Hardware](https://img.shields.io/badge/Status-Claimed_Hardware-amber) | Author reports successful physical robot deployment; independent community verification pending. |
| **Simulation Verified** | ![Simulation Verified](https://img.shields.io/badge/Status-Simulation_Verified-cyan) | Passed the registry's recorded MuJoCo simulation for the declared task and pinned model. |
| **Experimental** | ![Experimental](https://img.shields.io/badge/Status-Experimental-purple) | Community work-in-progress, new embodiment variation, or conceptual gait. |

---

## The MicroDuck Contract

All policies indexed in uDuck adhere to the unified ecosystem standard:

- **Observation Vector (61-D)**:
  - Proprioception (48-D): Measured joint positions (14), velocities (14), previous actions (14), projected gravity vector (3), gyro angular rate (3). Reads through mechanical backlash.
  - Twist Command (3-D): Operator intent `[vx, vy, yaw_rate]`.
  - Head Pose Command (4-D): Active neck/head target orientations `[neck_pitch, head_pitch, head_yaw, head_roll]`.
  - Body Pose Command (6-D): Torso 6-DOF offset `[tx, ty, tz, roll, pitch, yaw]`.
- **Action Vector (14 policy joints)**:
  - Left Leg (0–4): `hip_yaw`, `hip_roll`, `hip_pitch`, `knee`, `ankle`.
  - Neck & Head (5–8): `neck_pitch`, `head_pitch`, `head_yaw`, `head_roll`.
  - Right Leg (9–13): `hip_yaw`, `hip_roll`, `hip_pitch`, `knee`, `ankle`.
- **Control Frequency**: 50 Hz (0.005s MuJoCo physics timestep × 4 decimation).
- **Actuator Physics**: Dynamixel XL330 modeled via Rhoban BAM M6 voltage control law, back-EMF, and dynamic voltage sag.

---

## Seeded Behaviors

uDuck Registry ships populated with 14 indexed behaviors:

1. `alpha-walking` — **Alpha Dynamic Walk** *(Pollen Robotics · Verified Hardware)*
2. `fall-recovery` — **Dynamic Fall Recovery** *(Pollen Robotics · Verified Hardware)*
3. `ground-pick` — **Autonomous Ground Pick** *(Pollen Robotics · Verified Hardware)*
4. `sit-stand` — **Smooth Sit ↔ Stand** *(Pollen Robotics · Verified Hardware)*
5. `roulade` — **Acrobatic Roulade (Forward Roll)** *(Pollen Robotics · Verified Hardware)*
6. `ball-kick-left` — **Impulse Ball Kick (Left Foot)** *(Pollen Robotics · Verified Hardware)*
7. `ball-kick-right` — **Impulse Ball Kick (Right Foot)** *(Pollen Robotics · Verified Hardware)*
8. `roller-drive` — **Roller Skate Velocity Drive** *(Pollen Robotics · Verified Hardware)*
9. `roller-crouch` — **Roller Blade Crouch Glide** *(Pollen Robotics · Verified Hardware)*
10. `genesis-velocity` — **Genesis Flat Walk** *(Macmachi · Experimental)*
11. `genesis-rough` — **Genesis Rough-Terrain Walk** *(Macmachi · Experimental)*
12. `genesis-backlash` — **Genesis Backlash Walk** *(Macmachi · Experimental)*
13. `jump` — **Vertical Jump** *(Liyucheng1997 · Experimental)*
14. `courier` — **MicroDuck Courier** *(selinayfilizp · Experimental)*

Records marked `source_only` remain available for upstream follow-up, but do not appear in the public index until their policy artifact is available.

---

## Machine-Readable Access

The entire registry is accessible via simple HTTP GET requests without an API key:

```bash
# Fetch the deployed catalog (no repository access required)
curl -s https://uduck-registry.pages.dev/registry.json | jq .

# In a checkout with repository access, the same snapshot is:
# cat public/registry.json | jq .

# Or serve `out/` from your deployment host and request:
#   /registry.json
#   /api/behaviors/alpha-walking
```

---

## Quickstart & CLI

```bash
# Clone the repository
git clone https://github.com/ob1-s/uduck-registry.git
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

1. **Pull the pinned ONNX model:**
   ```bash
   pnpm cli pull alpha-walking /tmp/microduck-policies
   ```

2. **Copy the verified file to the robot and add its path to `/etc/robot/robotd.toml`:**
   ```toml
   [policy]
   walk = "/home/radxa/my_walking.onnx"
   ```

3. **Reload the onboard daemon:**
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

Apache License 2.0 for code (see [LICENSE](LICENSE)). 3D model files (MJCF/meshes) are CC BY-SA-NC by Pollen Robotics — we link, never host, them. See [NOTICE](NOTICE) for the full untangling.

---

## v0.1 — The Hardened Slice

Trust is computed, not claimed. How it works:

**Artifact integrity** — Every verified behavior's ONNX records a `sha256` + byte size. `uduck pull <id>` uses the optional local cache when available, otherwise downloads and verifies every byte before writing it. Artifact URLs are restricted to HTTPS on the two upstream hosts used by the seed data.

**Submission** — `uduck submit my-behavior.json` uses GitHub device-flow auth (`public_repo` scope only) to fork → branch → commit → open a PR. If any auth step fails, it prints a prefilled manual PR URL: submission is never a dead end.

**Sim verification CI** — `.github/workflows/sim-verify.yml` runs only for entries explicitly marked `verified_simulation`: a small ONNX compatibility check followed by the declared task's deterministic MuJoCo rollout. Hardware claims are not treated as simulation claims. The job runs on `pull_request` with no secrets and pinned simulation dependencies.

**Trust ladder** — `community_experimental` < `claimed_hardware` < `verified_simulation` < `verified_hardware`. Tiers are explicit: simulation CI recomputes `verified_simulation`, while maintainers must downgrade entries when an artifact or hardware claim no longer holds. Hardware attestation is a PR with committed video + logs — never a textbox.

Commands:
```bash
pnpm validate   # schema + contract + tier-integrity checks (byte-identical to CI)
pnpm vendor     # download artifacts, record sha256, vendor bytes
pnpm compile    # regenerate public/registry.json (CI snapshot-diffs it)
pnpm cli pull alpha-walking ./policies
pnpm cli submit my-behavior.json
```

Deliberately NOT built yet: upstream auto-sync, publisher namespaces, and a package/update service. The current release is a static catalog plus CLI and PR workflow.
