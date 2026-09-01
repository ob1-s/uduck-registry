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

The registry currently includes 19 indexed behaviors:

1. `alpha-walking` — **Alpha Dynamic Walk** *(Pollen Robotics · Hardware verified)*
2. `fall-recovery` — **Dynamic Fall Recovery** *(Pollen Robotics · Hardware verified)*
3. `ground-pick` — **Autonomous Ground Pick** *(Pollen Robotics · Hardware verified)*
4. `sit-stand` — **Smooth Sit ↔ Stand** *(Pollen Robotics · Hardware verified)*
5. `roulade` — **Acrobatic Roulade (Forward Roll)** *(Pollen Robotics · Hardware verified)*
6. `ball-kick-left` — **Impulse Ball Kick (Left Foot)** *(Pollen Robotics · Hardware verified)*
7. `ball-kick-right` — **Impulse Ball Kick (Right Foot)** *(Pollen Robotics · Hardware verified)*
8. `roller-drive` — **Roller Skate Velocity Drive** *(Pollen Robotics · Hardware verified)*
9. `roller-crouch` — **Roller Blade Crouch Glide** *(Pollen Robotics · Hardware verified)*
10. `genesis-velocity` — **Genesis Flat Walk** *(Macmachi · Experimental)*
11. `genesis-rough` — **Genesis Rough-Terrain Walk** *(Macmachi · Experimental)*
12. `genesis-backlash` — **Genesis Backlash Walk** *(Macmachi · Experimental)*
13. `jump` — **Vertical Jump** *(Liyucheng1997 · Experimental)*
14. `courier` — **Microduck Courier** *(selinayfilizp · Experimental)*
15. `running` — **Microduck Running** *(HannesVonEssen · Experimental)*
16. `flamingo-cycle` — **Flamingo Cycle** *(RemiFabre · Experimental)*
17. `rough-walk-e` — **Rough Walk E** *(RemiFabre · Experimental)*
18. `rough-walk-g` — **Rough Walk G** *(RemiFabre · Experimental)*
19. `max-height-jump` — **Maximum-Height Jump** *(Thomas Burgess · Experimental)*

## Machine-readable access

The generated catalog is available at:

```bash
curl -s https://uduckmoves.com/registry.json | jq .
```

The same snapshot is in [`public/registry.json`](public/registry.json). The static site also exposes one JSON endpoint per behavior at `/api/behaviors/<id>`.

## Contributing

Add one descriptor at `registry/behaviors/<id>.json`, run `pnpm check`, then open a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md) for the descriptor shape and review expectations.

## Attribution and license

uDuck Registry is an independent community project and is not affiliated with Pollen Robotics or Hugging Face.

Registry code and site content are Apache-2.0; see [LICENSE](LICENSE). Third-party policies, media, and upstream model assets remain under their respective licenses. See [NOTICE](NOTICE) for attribution details.
