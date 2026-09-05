# Awesome Microduck inventory

Working inventory for the uDuck Registry. This file records the current
curation surface of [`ob1-s/awesome-microduck`](https://github.com/ob1-s/awesome-microduck)
and the policy/choreography leads that were found but are not ready for a
uDuck Registry descriptor. It does not change the awesome list or add any of
the research leads to the registry.

Source snapshot: `ob1-s/awesome-microduck` `main` at
[`b0618dd`](https://github.com/ob1-s/awesome-microduck/commit/b0618ddf5941a6ac089b6e5ae2b156cbff7e9354),
retrieved 2026-08-31. The source README is preserved at
[`9a3e2ee`](https://github.com/ob1-s/awesome-microduck/blob/9a3e2ee78a4555bd21c3c20191c26aefed186b44/README.md).

## Curation model

The list is manually curated for signal: a short list of independent projects
someone can inspect, run, build, or learn from today.

Its contribution guide asks for:

- one project per line, with a direct canonical URL and one factual sentence;
- the narrowest fitting section, with entries alphabetized;
- an honest note when work is a fork, simulator-only, experimental, or the
  contributor's own project;
- early work when the repository is real and inspectable, even when it has
  clear limitations.

It excludes official Pollen repositories and launch material from the main
sections, generic dependencies, individual ONNX policies, task names,
challenge prompts, product bundles, and forks or mirrors without a meaningful
Microduck-specific change. Official material belongs in **Upstream reference**.

## Current awesome-list entries

The entries below are transcribed from the source snapshot without editorial
rewriting.

### Community software & integrations

- [DuckKit](https://github.com/craigm26/duckkit) — Pure Swift MicroDuck runtime and simulation package with policy loading, kinematics, protocol types, and Linux tests.
- [Embodied Agent](https://github.com/mjschock/embodied-agent) — Simulation-first multi-robot agent platform with a MicroDuck MuJoCo/ONNX adapter and semantic skill API.
- [Meckie Duck Gateway](https://github.com/rangerchaz/meckie-duck-gateway) — Small HTTP gateway and hardware-free protocol double for experimenting with MicroDuck control from scripts, agents, or home automation.
- [MicroDuck MCP](https://github.com/aj-dev-smith/microduck-mcp) — MCP server and CPU MuJoCo simulator exposing MicroDuck intents, sensing, tricks, camera frames, and agent-facing tools.
- [MicroDuck Runtime (legacy)](https://github.com/TommyZihao/microduck_runtime) — Community Raspberry Pi runtime with standing body-pose controls for Z height, pitch, and roll; exploratory and separate from Pollen's current runtime.
- [OpenCastor — MicroDuck](https://docs.opencastor.com/robots/microduck/) — Third-party OpenCastor integration that discovers MicroDucks, sends intent commands through `robotd`, and composes routines.
- [quackd](https://github.com/rokbenko/quackd) — LLM goal-planning layer with a bundled simulator, `.duck` task files, safety rules, and MCP support.
- [Strands Robots — MicroDuck](https://strands-labs.github.io/robots/policies/microduck/) — Third-party Python/MuJoCo provider for running Pollen MicroDuck policies through a common simulation and hardware interface.
- [uDuck Registry](https://uduck-registry.pages.dev/) — Community catalog of MicroDuck policy descriptors and artifact links.

### Simulation & policy research

- [Isaac Lab MicroDuck port](https://github.com/5usu/IsaacLab/blob/5usu/microduck-port/source/isaaclab_microduck/docs/README.md) — Isaac Lab extension with MicroDuck assets, BAM/backlash actuator models, RSL-RL tasks, and PhysX validation; simulation/training only.
- [MicroDuck Backflip](https://github.com/Lulzx/microduck-backflip/blob/main/docs/backflip.md) — Reproducible `mjlab` backflip task with a standing-only evaluation battery, experiment log, and explicit safety gates; simulation work, not a hardware claim.
- [MicroDuck Courier](https://github.com/selinayfilizp/microduck-courier) — MuJoCo apartment-delivery task with a trained policy, rollout artifacts, and telemetry.
- [MicroDuck Lab](https://github.com/jvpflum/microduck-lab) — DGX Spark workspace around the official training source with smoke tests, policy evaluation, and a local policy-bench workflow.
- [MicroDuck RL on Genesis](https://github.com/Macmachi/microduck-rl-genesis) — Genesis port of the MicroDuck walking task for AMD/ROCm systems with committed flat, rough-terrain, and backlash ONNX policies; Genesis–MuJoCo validation is documented, but no physical-robot validation.

### Demos & applications

- [MicroDuck AR](https://huggingface.co/spaces/multimodalart/microduck-ar) — Community WebXR/AR adaptation of the MicroDuck simulator with AR placement and ground-pick interaction; it uses Pollen's policies rather than publishing new weights.
- [MicroDuck iPhone Simulator](https://github.com/littlejohntj/microduck-sim) — Native Swift/MuJoCo/RealityKit simulator that runs the released policies on-device and includes AR mode.
- [MicroDuck Jump Playground](https://github.com/Liyucheng1997/318_lab-microduck-simulator) — Fork of the browser simulator with a custom-trained vertical-jump policy and live demo; simulation-only, with no hardware validation.
- [Microquack](https://github.com/lryain/microquack) — Procedural droid-voice engine and WebAssembly experience for MicroDuck, built around a reusable Rust core.

### Hardware & fabrication

- [MicroDuck Replica](https://github.com/fanhao375/microduck-replica) — MicroDuck mechanical reconstruction study with assembly drawings, CAD exports, hole analysis, and fabrication notes derived from the public MJCF/STL model.

### Upstream reference

Pollen's official MicroDuck software:

- [MicroDuck browser simulator](https://huggingface.co/spaces/pollen-robotics/microduck-simulator)
- [MicroDuck RL training source](https://github.com/pollen-robotics/microduck_rl)
- [MicroDuck runtime](https://github.com/pollen-robotics/microduck)

## Recent policy work already accepted by uDuck

These are intentionally not repeated in the not-ready queue:

- [Microduck Running](../registry/behaviors/running.json)
- [Flamingo Cycle](../registry/behaviors/flamingo-cycle.json)
- [Rough Walk E](../registry/behaviors/rough-walk-e.json)
- [Rough Walk G](../registry/behaviors/rough-walk-g.json)

They are standalone public ONNX exports that meet the current 61-observation,
14-action, 50 Hz descriptor contract, and are listed in the registry as
`community_experimental`.

## Policy and choreography leads not yet uDuck-ready

“Not uDuck-ready” here means not ready for a current uDuck Registry descriptor;
it does not mean the project is uninteresting or should never appear on the
awesome list.

### Public policy artifacts with a current registry blocker

- [Step-Up + Head-Brake Recovery](https://github.com/bihaokun/microduck-step-up-policy) ([Hugging Face release](https://huggingface.co/Nupr-Haokun/microduck-step-up-head-brake)) — Strong simulation-only release with two coordinated ONNX policies, a public source snapshot, and a 25 mm step-up evaluation. The current registry schema models one ONNX artifact per descriptor, so the walking/recovery bundle needs a small schema or descriptor-design decision first.
- [Polite Bow](https://huggingface.co/fffiloni/microduck-polite-bow-b1d864) — Public ONNX and simulation preview; the card reports a passed export/quality gate, but does not state 50 Hz and does not provide an explicit artifact license.
- [Backward Moonwalk](https://huggingface.co/fffiloni/microduck-moonwalk-backward-55e6af) — Public ONNX and preview for a backward moonwalk task, but the card marks its quality gate as needing review, leaves semantic matching unverified, does not state 50 Hz, and has no explicit artifact license.
- [nottyduck](https://github.com/reachjalil/nottyduck) ([policy Hub](https://huggingface.co/reachjalil/nottyduck-policies)) — Real desk-companion/training-lab project, but the public policy Hub currently contains no downloadable policy artifact beyond its README/scaffold.

### Choreography, imitation, and behavior-task leads

- [Electric Slide Motion dataset](https://huggingface.co/datasets/Histochemichael/microduck-electric-slide-motion) ([companion policy endpoint](https://huggingface.co/api/models/Histochemichael/microduck-electric-slide-policy)) — Public human-motion, retargeting, and MuJoCo choreography data with a 50 Hz Microduck reference. The companion policy is currently inaccessible/private, so this is a research dataset rather than a downloadable behavior policy.
- [MicroDuck Sidekick Dance](https://github.com/pezzonovante7/microduck-sidekick-dance) — Inspectable lateral-dance `mjlab` task and training scaffold, but its README says it is task-only and does not publish a trained ONNX artifact.
- [MicroDuck Backflip](https://github.com/Lulzx/microduck-backflip) — Public research code and a partial ONNX export, but the documented v44 result is apex-to-mat recovery and the v88 result is assisted rather than a complete autonomous standing-start backflip. It is already an awesome-list research entry, not a clean registry behavior.
- [MicroDuck Parkour](https://github.com/bentedesco/microduck-parkour) — Parkour behavior lead, but the repository does not currently provide a usable released policy artifact or enough inspectable implementation to add it to the registry.

## Search exclusions worth retaining

- [`mjlab_microduck_waddle`](https://github.com/nickoenig37/mjlab_microduck_waddle) targets the separate Waddle robot, despite the repository name.
- [Arvmor's simulator fork](https://github.com/Arvmor/microduck-simulator) wires in the existing jump work but does not provide a distinct usable policy release.
- Simulator mirrors and browser ports that only repackage Pollen's nine official policies are useful ecosystem projects, but they are not new policy entries.
