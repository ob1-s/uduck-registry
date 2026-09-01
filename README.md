# 🦆 uDuck Registry

> A community directory of downloadable behavior policies for [Microduck](https://github.com/pollen-robotics/microduck).

[![CI](https://github.com/ob1-s/uduck-registry/actions/workflows/ci.yml/badge.svg)](https://github.com/ob1-s/uduck-registry/actions)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

## What is it?

uDuck Registry is a searchable catalog of community and official Microduck behavior policies. Each entry links to its canonical ONNX artifact and source, describes the robot and accessories it needs, and includes the relevant `robotd` configuration.

Microduck is a small biped robot from [Pollen Robotics](https://pollen-robotics.com). Policies in this catalog use the shared 61-observation, 14-action, 50 Hz runtime contract.

## Behavior status

| Status | Meaning |
| --- | --- |
| **Hardware verified** | Shipped by the upstream project or supported by physical-run evidence. |
| **Hardware claimed** | The author reports a physical run; the registry has not independently reproduced it. |
| **Experimental** | Community work that has not established physical deployment evidence. |

## Runtime contract

- **Observation:** 61 values — 48 proprioception values, 3 command values, 4 head-pose values, and 6 body-pose values.
- **Action:** 14 joint targets — 5 left-leg, 4 neck/head, and 5 right-leg outputs.
- **Rate:** 50 Hz with the policy's declared decimation and action scale.
- **Actuator:** Dynamixel XL330 motors using the declared Microduck actuator model.
- The beak actuator is outside the fixed 14-action policy interface.

The descriptor schema is [`registry/schema/behavior.schema.json`](registry/schema/behavior.schema.json).

## Catalog

The table below is generated from the descriptors in `registry/behaviors/`.

<!-- BEGIN GENERATED BEHAVIOR TABLE -->

| Behavior | ID | Category | Status | Publisher | Setup | Preview |
| --- | --- | --- | --- | --- | --- | --- |
| [Acrobatic Roulade (Forward Roll)](https://uduckmoves.com/behaviors/roulade) | `roulade` | agility tricks | Hardware verified | Pollen Robotics | none | — |
| [Alpha Dynamic Walk](https://uduckmoves.com/behaviors/alpha-walking) | `alpha-walking` | locomotion | Hardware verified | Pollen Robotics | none | video + poster |
| [Autonomous Ground Pick](https://uduckmoves.com/behaviors/ground-pick) | `ground-pick` | manipulation | Hardware verified | Pollen Robotics | none | video + poster |
| [Dynamic Fall Recovery](https://uduckmoves.com/behaviors/fall-recovery) | `fall-recovery` | recovery | Hardware verified | Pollen Robotics | none | video + poster |
| [Impulse Ball Kick (Left Foot)](https://uduckmoves.com/behaviors/ball-kick-left) | `ball-kick-left` | manipulation | Hardware verified | Pollen Robotics | 70mm practice ball | video + poster |
| [Impulse Ball Kick (Right Foot)](https://uduckmoves.com/behaviors/ball-kick-right) | `ball-kick-right` | manipulation | Hardware verified | Pollen Robotics | 70mm practice ball | — |
| [Roller Blade Crouch Glide](https://uduckmoves.com/behaviors/roller-crouch) | `roller-crouch` | roller skate | Hardware verified | Pollen Robotics | roller skate blades | — |
| [Roller Skate Velocity Drive](https://uduckmoves.com/behaviors/roller-drive) | `roller-drive` | roller skate | Hardware verified | Pollen Robotics | roller skate blades | video + poster |
| [Smooth Sit ↔ Stand](https://uduckmoves.com/behaviors/sit-stand) | `sit-stand` | locomotion | Hardware verified | Pollen Robotics | none | video + poster |
| [Flamingo Cycle](https://uduckmoves.com/behaviors/flamingo-cycle) | `flamingo-cycle` | agility tricks | Experimental | RemiFabre | none | video |
| [Genesis Backlash Walk](https://uduckmoves.com/behaviors/genesis-backlash) | `genesis-backlash` | locomotion | Experimental | Macmachi | none | — |
| [Genesis Flat Walk](https://uduckmoves.com/behaviors/genesis-velocity) | `genesis-velocity` | locomotion | Experimental | Macmachi | none | — |
| [Genesis Rough-Terrain Walk](https://uduckmoves.com/behaviors/genesis-rough) | `genesis-rough` | locomotion | Experimental | Macmachi | none | — |
| [Maximum-Height Jump](https://uduckmoves.com/behaviors/max-height-jump) | `max-height-jump` | agility tricks | Experimental | Thomas Burgess | none | loop + video |
| [Microduck Courier](https://uduckmoves.com/behaviors/courier) | `courier` | manipulation | Experimental | selinayfilizp | none | video + poster |
| [Microduck Running](https://uduckmoves.com/behaviors/running) | `running` | locomotion | Experimental | HannesVonEssen | none | video |
| [Rough Walk E](https://uduckmoves.com/behaviors/rough-walk-e) | `rough-walk-e` | locomotion | Experimental | RemiFabre | none | video |
| [Rough Walk G](https://uduckmoves.com/behaviors/rough-walk-g) | `rough-walk-g` | locomotion | Experimental | RemiFabre | none | video |
| [Vertical Jump](https://uduckmoves.com/behaviors/jump) | `jump` | agility tricks | Experimental | Liyucheng1997 | none | — |

<!-- END GENERATED BEHAVIOR TABLE -->

## Simulation CI

Pull requests touching `registry/behaviors/` are automatically run through a
headless MuJoCo simulation check (`Sim Check` workflow): the contributed ONNX
is executed at the shared 50 Hz runtime contract under a standard command
profile, verified (finite outputs, stability, recovery, tracking), and a
standardized 512x512 render loop is produced as a workflow artifact for review.
See [`simulation/README.md`](simulation/README.md) for the render standard,
command profiles, and fidelity notes.

## Machine-readable access

The generated catalog is available at:

```bash
curl -s https://uduckmoves.com/registry.json | jq .
```

The same snapshot is in [`public/registry.json`](public/registry.json). The static site also exposes one JSON endpoint per behavior at `/api/behaviors/<id>`.

## Contributing

Generate a starting descriptor with `pnpm --silent new-behavior id=my-move name="My Move" category=locomotion author="Your Name"`, run `pnpm check`, include the refreshed `README.md` and `public/registry.json`, then open a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for the descriptor shape and review expectations.

## Attribution and license

uDuck Registry is an independent community project and is not affiliated with Pollen Robotics or Hugging Face.

Registry code and site content are Apache-2.0; see [LICENSE](LICENSE). Third-party policies, media, and upstream model assets remain under their respective licenses. See [NOTICE](NOTICE) for attribution details.
