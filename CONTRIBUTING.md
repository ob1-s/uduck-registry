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
   This verifies the runtime schema, the 61-observation / 14-action / 50 Hz
   contract, and the recorded artifact metadata for verified entries. It does not
   make network requests or decide whether a hardware claim is true.

   If you add or replace a verified ONNX file, run `pnpm vendor` to record its
   size and SHA-256. The resulting file in `vendor/policies/` is an optional
   local cache; CI and clean checkouts use the recorded metadata and verify
   downloads when needed.

4. **Run Unit Tests:**
   ```bash
   pnpm test
   ```

   Before opening a PR, regenerate the public snapshot and build the static
   site:

   ```bash
   pnpm compile
   pnpm build
   ```

5. **Submit a Pull Request:**
   Open a PR. In your PR description, explain:
   - The training environment or code source.
   - Any video proof of physical hardware testing (if claiming `verified_hardware`).
   - Hardware requirements or accessories.

---

## Verification Tiers

To protect physical hardware, we enforce honest verification labels:

* `verified_hardware`: The submission includes hardware evidence in its PR or is
  explicitly backed by an upstream release.
* `claimed_hardware`: The author reports a hardware run, but the registry has
  not independently reproduced it.
* `verified_simulation`: The entry has a passing recorded MuJoCo run using its
  declared policy and model.
* `community_experimental`: Early-stage, unavailable, or otherwise unverified
  policy exploration.

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
    "status": "community_experimental",
    "summary": "Early community policy; simulation and hardware evidence pending.",
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
