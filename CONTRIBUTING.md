# Contributing to uDuck Registry

uDuck Registry is a directory of MicroDuck behavior policies. A contribution is one JSON descriptor that points to the policy artifact and its source.

## Add a behavior

1. Fork and clone the repository.

   ```bash
   git clone https://github.com/<your-username>/uduck-registry.git
   cd uduck-registry
   pnpm install
   ```

2. Add `registry/behaviors/<id>.json`. The filename must match the lowercase kebab-case `id`.

3. Use `community_experimental` unless the upstream project or a pull request provides physical-run evidence. Use `claimed_hardware` when the author reports a physical run that the registry has not reproduced. Use `verified_hardware` only for an upstream-supported behavior or a submission with physical evidence.

4. Point `artifacts.onnx.url` at the canonical ONNX file. The registry links to that file and does not copy policy weights into the repository.

5. Run the checks and rebuild the catalog:

   ```bash
   pnpm validate
   pnpm test
   pnpm compile
   pnpm build
   ```

6. Open a pull request with the upstream source, license, hardware requirements, and any evidence supporting the verification label.

## Descriptor shape

```json
{
  "id": "my-cool-trick",
  "name": "My Cool Duck Trick",
  "version": "1.0.0",
  "description": "A short explanation of the behavior.",
  "category": "agility-tricks",
  "tags": ["community", "trick"],
  "authors": [{ "name": "Your Name", "github": "yourgithub" }],
  "license": "Apache-2.0",
  "verification": {
    "status": "community_experimental",
    "summary": "Community policy with no physical deployment evidence yet.",
    "hardware_target": "MicroDuck v1"
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
    "action_scale": 1
  },
  "compatibility": {
    "robot_model": "microduck-standard",
    "accessories_required": [],
    "terrain": ["flat"],
    "robotd_slot": "walk"
  },
  "artifacts": {
    "onnx": {
      "filename": "my_cool_trick.onnx",
      "url": "https://huggingface.co/your-org/my-cool-trick/resolve/main/my_cool_trick.onnx",
      "baked_normalizer": true
    }
  },
  "media": { "hero_type": "badge" },
  "sources": { "upstream_repo": "https://github.com/yourgithub/my-duck-repo" },
  "deployment": { "robotd_toml": "[policy]\nwalk = \"/opt/robot/policies/my_cool_trick.onnx\"" }
}
```

The complete field definitions are in [`registry/schema/behavior.schema.json`](registry/schema/behavior.schema.json).
