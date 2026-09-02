# Contributing to uDuck Registry

uDuck Registry is a directory of Microduck behavior policies. A contribution is one JSON descriptor that points to the policy artifact and its source.

## Add a behavior

1. Fork and clone the repository.

   ```bash
   git clone https://github.com/<your-username>/uduck-registry.git
   cd uduck-registry
   pnpm install
   ```

   First-time fork contributions may show a pending workflow until a maintainer approves it.

2. Generate a descriptor scaffold so the fixed Microduck contract does not need to be written by hand:

   ```bash
   pnpm --silent new-behavior id=my-cool-trick name="My Cool Duck Trick" category=agility-tricks author="Your Name" > registry/behaviors/my-cool-trick.json
   ```

   Replace the TODO values and update the source, artifact, compatibility, deployment, and media fields. The command only writes JSON to stdout; it does not contact GitHub or open a pull request.

3. The filename must match the lowercase kebab-case `id`. Use `community_experimental` unless the upstream project or a pull request provides physical-run evidence. Use `claimed_hardware` when the author reports a physical run that the registry has not reproduced. Use `verified_hardware` only for an upstream-supported behavior or a submission with physical evidence.

4. Point `artifacts.onnx.url` at the canonical ONNX file. Use `https://huggingface.co/...` or `https://raw.githubusercontent.com/...`; these are the artifact hosts accepted by registry validation. The registry links to that file and does not copy policy weights into the repository.

5. Run the checks and rebuild the catalog:

   ```bash
   pnpm check
   ```

   This refreshes `README.md` and `public/registry.json`; include both generated files in your pull request.

6. Open a pull request with the upstream source, license, hardware requirements, and any evidence supporting the verification label.

### Preview media

- `video_url` is the main demonstration for the behavior page. It can show the full context of a move and has player controls.
- `loop_url` is the muted, autoplaying preview used on explorer cards. Keep it short and focused on the movement. If it is omitted, cards fall back to `video_url`.
- `thumbnail_url` is an optional static poster or fallback image.

For a local media path such as `/media/my-move/loop.mp4`, include the matching file at `public/media/my-move/loop.mp4` in the pull request.

### CI simulation check

Every pull request that adds or edits a descriptor is automatically run
through the registry's headless MuJoCo runner only when it declares an explicit
`simulation` recipe. `compatibility.robotd_slot` never selects the simulation
scenario. The workflow uploads `report.json`, `loop.mp4`, and `poster.png` for
human review; it does not publish them automatically.

The report distinguishes a completed render from its individual observations.
Requested checks use a fixed registry vocabulary, and their results are
measured by the runner—not authored in the descriptor. A render is not hardware
verification or proof that a publisher's training environment was reproduced.
The runner rejects recipes it cannot represent before downloading the policy;
it does not silently clamp command values.

If the policy requires custom environment code, objects, meshes, dependencies,
or a different observation/action contract, use `"runner": "external"` with
an honest reason and provide publisher-owned media instead. Do not give CI a
convenient but inaccurate command schedule just so the policy can be rendered.
Do not add per-policy executable code to this repository.

See [`simulation/README.md`](simulation/README.md) for recipe examples, start
states, supported scenarios, exact report semantics, and CI isolation rules.

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
    "hardware_target": "Microduck v1"
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
