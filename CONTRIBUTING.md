# Contributing to uDuck Registry

Thank you for contributing to **uDuck Registry**! 🦆

Our mission is to make the MicroDuck robotics ecosystem immediately legible and composable. Adding a behavior should be as simple as adding a single JSON file to the repository.

---

## The Contribution Workflow

1. **Fork & Clone:**
   ```bash
   git clone https://github.com/<your-username>/uduck-registry.git
   cd uduck-registry
   pnpm install
   ```

2. **Create Your Behavior Descriptor:**
   Create a new file in `registry/behaviors/<id>.json`. The filename must match the `id` field exactly.

3. **Validate Invariants:**
   Run the automated validation tool:
   ```bash
   pnpm validate
   ```
   This verifies that:
   - Your file adheres to `registry/schema/behavior.schema.json`.
   - The observation dimension is exactly `61`.
   - The action dimension is exactly `14`.
   - Control loop frequency is `50` Hz.
   - All URLs are valid and accessible.
   - Verification status is accurate.

4. **Run Unit Tests:**
   ```bash
   pnpm test
   ```

5. **Submit a Pull Request:**
   Open a PR. In your PR description, explain:
   - The training environment or code source.
   - Any video proof of physical hardware testing (if claiming `verified_hardware`).
   - Hardware requirements or accessories.

---

## Verification Tiers

To protect physical hardware, we enforce honest verification labels:

* `verified_hardware`: You or Pollen have filmed this policy running successfully on physical MicroDuck hardware without catastrophic joint oscillation.
* `claimed_hardware`: You have run this on hardware and provide telemetry/description, but independent reproduction is pending.
* `verified_simulation`: You trained and validated this in MuJoCo / mjlab simulation.
* `community_experimental`: Early-stage or untested policy exploration.

---

## Starter JSON Template

```json
{
  "id": "my-cool-policy",
  "name": "My Cool Policy",
  "version": "1.0.0",
  "description": "Concise description of the behavior.",
  "category": "locomotion",
  "tags": ["community", "locomotion", "50hz"],
  "authors": [
    {
      "name": "Your Name",
      "github": "your-handle"
    }
  ],
  "license": "Apache-2.0",
  "verification": {
    "status": "verified_simulation",
    "summary": "Trained in mjlab across 4096 environments.",
    "hardware_target": "MicroDuck v1 (Dynamixel XL330)",
    "sim_framework": "mjlab (MuJoCo Warp) at 50 Hz"
  },
  "contract": {
    "observation_dim": 61,
    "observation_breakdown": {
      "proprioception": 48,
      "twist": 3,
      "head_pose": 4,
      "body_pose": 6
    },
    "action_dim": 14,
    "action_breakdown": {
      "left_leg": 5,
      "neck_head": 4,
      "right_leg": 5
    },
    "control_frequency_hz": 50,
    "decimation": 4,
    "actuator_model": "Dynamixel XL330 (BAM M6 actuator physics)",
    "action_scale": 1.0
  },
  "compatibility": {
    "robot_model": "microduck-standard",
    "mjcf_model": "robot_walk.xml",
    "accessories_required": [],
    "terrain": ["flat"],
    "robotd_slot": "walk"
  },
  "artifacts": {
    "onnx": {
      "filename": "my_cool_policy.onnx",
      "url": "https://huggingface.co/.../my_cool_policy.onnx",
      "baked_normalizer": true
    }
  },
  "media": {
    "hero_type": "badge",
    "caption": "My duck in action"
  },
  "sources": {
    "upstream_repo": "https://github.com/your-handle/my-repo"
  },
  "deployment": {
    "robotd_toml": "[policy]\nwalk = \"/opt/robot/policies/my_cool_policy.onnx\""
  }
}
```
