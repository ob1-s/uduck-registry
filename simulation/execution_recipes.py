"""Maintainer-owned execution recipes for resolved policy artifacts.

Authored policy files contain immutable upstream identity and curation only.
This small, reviewed layer is the only place where an upstream command example
can become an executable registry recipe. A missing recipe is a visible
``not-covered`` result, never a guessed command or runtime escape hatch.
"""

from __future__ import annotations

from copy import deepcopy
from math import isfinite
from typing import Any

RUNNER = "microduck-standard-v1"
MODEL = "microduck-standard"
SCENE = "flat-v1"
START = {"preset": "settled_standing"}

FLAMINGO_REPO = "RemiFabre/microduck-flamingo-cycle"
FLAMINGO_NAME = "flamingo-cycle"
FLAMINGO_SOURCE = {
    "provider": "huggingface-model",
    "repo": FLAMINGO_REPO,
    "revision": "6646428394c6997106d2dc07c1588f20f6fea026",
    "artifact_path": "policy.onnx",
    "manifest_sha256": "ac9b9ae16b4f21733990710275bd934c97558c6028e060bd2b34ec1f5341d302",
    "artifact_sha256": "df77929c39d7695092bdaf810c2075e20a9ba91abd8192b4073d3de593d56904",
    "manifest_path": "manifest.json",
}
FLAMINGO_HOLD_S = 5.0
FLAMINGO_COMMAND = (1.0, 1.0, 0.0)
UPSTREAM_PIN = "bc41fb5c9a9b39894669c1e022e375cf83800382"
UPSTREAM_MANIFEST_URL = f"https://github.com/pollen-robotics/microduck/blob/{UPSTREAM_PIN}/docs/policy-manifest.md"
UPSTREAM_CHEATSHEET_URL = f"https://github.com/pollen-robotics/microduck/blob/{UPSTREAM_PIN}/docs/robot/cheatsheet.md"
UPSTREAM_CONTROL_URL = f"https://github.com/pollen-robotics/microduck/blob/{UPSTREAM_PIN}/robotd/src/control.rs"
ROULADE_RECOVERY_TAIL_S = 3.0

POLLEN_POLICY_REPO = "pollen-robotics/microduck-policies"
POLLEN_POLICY_REVISION = "088524a64e2557dc453256b6071dbb9d23888802"
POLLEN_MANIFEST_PATH = "manifest.json"
POLLEN_MANIFEST_SHA256 = "d0c36e7b71129dd617339c63bcb1d704eab282c8617ebf14c2013a01abfb2dda"
POLLEN_MANIFEST_URL = f"https://huggingface.co/{POLLEN_POLICY_REPO}/blob/{POLLEN_POLICY_REVISION}/{POLLEN_MANIFEST_PATH}"
POLLEN_ARTIFACT_SHA256 = {
    "alpha_walking.onnx": "e36332d383997d51401897734cd3e79cf5038406feddb18b4d57ecfb141daa6c",
    "alpha_stand.onnx": "1569268713e40deea795dd2922dba50d3621e15a872855408b6b1b125b1c094b",
    "alpha_ground_pick.onnx": "ffbf5109982ff999b0ba53afe86b9ae731bbec679d67fb7f8ab4c52152c88872",
    "roller.onnx": "cf05651d2708a2f9364212e86b866c97a70ace8131c492500105e8f28bf99afd",
    "roller_crouch.onnx": "a1a084be240469c76ac9d3fa44d4792f16d4b1da60398b3ecd3cfc5e2244d990",
    "roulade.onnx": "3d60da08fc13f29c1b57f41977aa898132c0d60042100149d8e775affcbca32b",
    "ball_kick_left.onnx": "d6928284dccd3dd61e08bf2f760effa74309fbefd97b2b31afb2a60f526d196a",
    "ball_kick_right.onnx": "147a32c388c6b19111b3ac3b550a9a6dc8b8bf267118af4d8c3712522eedb5af",
    "alpha_sitstand.onnx": "c6c40e35e726eabd803d633e090d112994f469921152448367953fbaf9799bc8",
}

GENESIS_REPO = "Macmachi/microduck-rl-genesis"
GENESIS_REVISION = "9d1f213879650f2623e3bbd7bf06fe63dbf71a10"
GENESIS_ARTIFACT_SHA256 = {
    "policies/backlash.onnx": "3f8db8bc2c11b2e41665633c1780af21bae3fda7db229eb5035e6c2d5698c075",
    "policies/rough.onnx": "04261902d3651dc02303e3e9e5ab756062c4d93c45400f431a0ae68b5969185c",
    "policies/velocity.onnx": "c315b9159a1b6f30976c90074ed6df2a33e7e1d14ef1505aed6c2c673f59061d",
}

JUMP_SOURCE = {
    "provider": "github",
    "repo": "Liyucheng1997/318_lab-microduck-simulator",
    "revision": "512d4bec6fc3ba321d29c93312be72856ad21268",
    "artifact_path": "app/public/policies/jump.onnx",
    "artifact_sha256": "0b10d7f50f2225467771c1fd11e027490e775b762c2e50c9e25f82c0f488e5c4",
    "manifest_path": None,
    "manifest_sha256": None,
}

MAX_HEIGHT_JUMP_SOURCE = {
    "provider": "github",
    "repo": "ThomasBurgess2000/microduck-max-height-jump",
    "revision": "7e5dc6028900f13d145e6710847378b007a675e9",
    "artifact_path": "policy/max_height_jump.onnx",
    "artifact_sha256": "046debd3eebd61a8c027d5595c1bca4fe32056fbb0ae63ac0b2f4e3798e1270f",
    "manifest_path": None,
    "manifest_sha256": None,
}


def _duration(value: Any) -> float | None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    value = float(value)
    return value if isfinite(value) and 0.0 < value <= 30.0 else None


def _source_matches(source: dict[str, Any] | None, expected: dict[str, Any]) -> bool:
    return isinstance(source, dict) and all(source.get(key) == value for key, value in expected.items())


def _pollen_source(artifact_path: str) -> dict[str, Any]:
    return {
        "provider": "huggingface-model",
        "repo": POLLEN_POLICY_REPO,
        "revision": POLLEN_POLICY_REVISION,
        "artifact_path": artifact_path,
        "artifact_sha256": POLLEN_ARTIFACT_SHA256[artifact_path],
        "manifest_path": POLLEN_MANIFEST_PATH,
        "manifest_sha256": POLLEN_MANIFEST_SHA256,
    }


def _execution_contract(action_scale: float, model: str = MODEL) -> dict[str, Any]:
    """Contract facts admitted only by an exact trusted source recipe."""

    return {
        "obs_len": 61,
        "action_len": 14,
        "action_scale": float(action_scale),
        "robot": {"model": "microduck", "hw_rev": 1, "servos": "xl330", "control_hz": 50},
        "model": model,
    }


def _provenance(source: str, source_url: str, scope: str, **facts: Any) -> dict[str, Any]:
    return {
        "owner": "uduck-registry-maintainers",
        "source": source,
        "source_url": source_url,
        "scope": scope,
        **facts,
    }


def _velocity_recipe(
    *,
    model: str,
    action_scale: float,
    provenance: dict[str, Any],
    yaw_rate: float = 0.5,
    contract: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """A finite, source-bound locomotion diagnostic, not a publisher eval."""

    recipe = {
        "runner": RUNNER,
        "model": model,
        "scene": SCENE,
        "start": deepcopy(START),
        "scenario": "velocity",
        "duration_s": 6.0,
        "segments": [
            {"duration_s": 1.0, "vx": 0.0, "vy": 0.0, "wz": 0.0},
            {"duration_s": 3.0, "vx": 0.25, "vy": 0.0, "wz": 0.0},
            {"duration_s": 2.0, "vx": 0.25, "vy": 0.0, "wz": yaw_rate},
        ],
        "checks": ["no_fall", "ends_upright", "velocity_tracking"],
        "action_scale": float(action_scale),
        "provenance": provenance,
    }
    if contract is not None:
        recipe["contract"] = contract
    return recipe


def _official_phase_recipe(manifest: dict[str, Any], source: dict[str, Any], *, roller: bool) -> dict[str, Any] | None:
    command = manifest.get("command")
    duration = _duration(manifest.get("duration_s"))
    if (
        manifest.get("kind") != "episodic"
        or not isinstance(command, dict)
        or command.get("encoding") != "phase"
        or not isinstance(command.get("period_s"), (int, float))
        or not isinstance(command.get("end_phase"), (int, float))
        or duration is None
        or not isfinite(float(command["period_s"]))
        or not isfinite(float(command["end_phase"]))
        or not 0.0 < float(command["period_s"])
        or not 0.0 < float(command["end_phase"]) <= 1.0
    ):
        return None
    model = "microduck-rollers" if roller else MODEL
    action_scale = manifest.get("action_scale", 0.8 if roller else 1.0)
    if isinstance(action_scale, bool) or not isinstance(action_scale, (int, float)) or not isfinite(float(action_scale)):
        return None
    return {
        "runner": RUNNER,
        "model": model,
        "scene": SCENE,
        "start": deepcopy(START),
        "scenario": "oneshot_phase",
        "duration_s": duration,
        "period_s": float(command["period_s"]),
        "end_phase": float(command["end_phase"]),
        "checks": ["no_fall", "ends_upright"],
        "action_scale": float(action_scale),
        "provenance": _provenance(
            "Exact per-file Pollen schema-2 manifest plus the upstream phase-command contract",
            POLLEN_MANIFEST_URL,
            "Registry diagnostic rollout under flat-v1 with the manifest's phase timing; this does not establish intended-task success or hardware verification.",
            policy_set_revision=POLLEN_POLICY_REVISION,
            manifest_sha256=POLLEN_MANIFEST_SHA256,
            artifact_path=source["artifact_path"],
            command_encoding="phase",
            command_slots=command.get("slots"),
            period_s=float(command["period_s"]),
            end_phase=float(command["end_phase"]),
            action_scale=float(action_scale),
            robot_model=model,
        ),
    }


def _official_stand_handoff(at_s: float) -> dict[str, Any]:
    return {
        "at_s": at_s,
        "name": "stand",
        "source": _pollen_source("alpha_stand.onnx"),
        "action_scale": 1.0,
        "provenance": _provenance(
            "Exact pinned Pollen alpha stand artifact and the pinned robotd skill-expiry selection",
            UPSTREAM_CONTROL_URL,
            "At the released episodic skill deadline, the zero external twist hands control back to the exact pinned stand policy; this is part of the registry diagnostic execution, not publisher hardware evidence.",
            policy_set_revision=POLLEN_POLICY_REVISION,
            manifest_sha256=POLLEN_MANIFEST_SHA256,
            artifact_path="alpha_stand.onnx",
            artifact_sha256=POLLEN_ARTIFACT_SHA256["alpha_stand.onnx"],
            action_scale=1.0,
            selection="zero external command selects stand after the active skill expires",
        ),
    }


def _official_recipe(manifest: dict[str, Any], source: dict[str, Any]) -> dict[str, Any] | None:
    artifact_path = source.get("artifact_path")
    if not isinstance(artifact_path, str) or artifact_path not in POLLEN_ARTIFACT_SHA256:
        return None
    if not _source_matches(source, _pollen_source(artifact_path)) or manifest.get("file") != artifact_path:
        return None

    if artifact_path == "alpha_walking.onnx" and manifest.get("kind") == "perpetual":
        return _velocity_recipe(
            model=MODEL,
            action_scale=0.9,
            provenance=_provenance(
                "Pollen policy manifest and the pinned Microduck alpha runtime command contract",
                UPSTREAM_MANIFEST_URL,
                "Finite flat-v1 velocity diagnostic for a perpetual gait; this is not publisher evaluation or hardware evidence.",
                policy_set_revision=POLLEN_POLICY_REVISION,
                manifest_sha256=POLLEN_MANIFEST_SHA256,
                artifact_path=artifact_path,
                command_semantics="twist = [vx, vy, wz] from the Microduck 61D command block",
                command_schedule="idle 1s, forward 0.25m/s 3s, forward 0.25m/s plus yaw 0.5rad/s 2s",
                action_scale=0.9,
                action_scale_source=UPSTREAM_CONTROL_URL,
            ),
        )

    if artifact_path == "roller.onnx" and manifest.get("kind") == "perpetual" and manifest.get("mode") == "roller" and manifest.get("action_scale") == 0.8:
        return _velocity_recipe(
            model="microduck-rollers",
            action_scale=0.8,
            yaw_rate=0.25,
            provenance=_provenance(
                "Exact Pollen policy-set manifest plus the pinned roller command contract",
                POLLEN_MANIFEST_URL,
                "Finite flat-v1 roller diagnostic using the pinned roller MJCF; this does not reproduce publisher roller evaluation or establish hardware evidence.",
                policy_set_revision=POLLEN_POLICY_REVISION,
                manifest_sha256=POLLEN_MANIFEST_SHA256,
                artifact_path=artifact_path,
                command_semantics="twist = [vx, vy, wz]; roller diagnostic stays within the documented 0.6m/s forward and 0.3rad/s yaw envelope",
                command_schedule="idle 1s, forward 0.25m/s 3s, forward 0.25m/s plus yaw 0.25rad/s 2s",
                action_scale=0.8,
            ),
        )

    if artifact_path == "alpha_ground_pick.onnx":
        return _official_phase_recipe(manifest, source, roller=False)
    if artifact_path == "roller_crouch.onnx" and manifest.get("mode") == "roller" and manifest.get("action_scale") == 0.8:
        return _official_phase_recipe(manifest, source, roller=True)

    if artifact_path in {"roulade.onnx", "ball_kick_left.onnx", "ball_kick_right.onnx"}:
        if manifest.get("kind") != "episodic" or _duration(manifest.get("duration_s")) is None:
            return None
        if manifest.get("command") not in (None, {}):
            return None
        command_duration = float(manifest["duration_s"])
        recovery_tail = ROULADE_RECOVERY_TAIL_S if artifact_path == "roulade.onnx" else 0.0
        capture_duration = command_duration + recovery_tail
        checks = ["recover_upright"] if artifact_path == "roulade.onnx" else ["no_fall", "ends_upright"]
        handoff = _official_stand_handoff(command_duration) if artifact_path == "roulade.onnx" else None
        scope = (
            "Registry diagnostic rollout of the exact policy command window followed by the pinned stand-policy handoff under flat-v1; final checks cover the full capture horizon and this does not establish intended-task success or hardware verification."
            if handoff is not None
            else "Registry diagnostic rollout of the exact policy command window under flat-v1; this does not establish intended-task success or hardware verification."
        )
        provenance = _provenance(
            "Exact per-file Pollen schema-2 manifest and the pinned robotd zero-command skill contract",
            UPSTREAM_MANIFEST_URL,
            scope,
            policy_set_revision=POLLEN_POLICY_REVISION,
            manifest_sha256=POLLEN_MANIFEST_SHA256,
            artifact_path=artifact_path,
            command=[0.0, 0.0, 0.0],
            command_semantics="Selecting an ordinary constant episodic skill is the trigger; the upstream runtime feeds the all-zero twist.",
            action_scale=1.0,
            action_scale_source=UPSTREAM_CONTROL_URL,
            chain=bool(manifest.get("chain", False)),
            command_duration_s=command_duration,
            post_command_settle_s=recovery_tail,
            capture_duration_s=capture_duration,
        )
        if handoff is not None:
            provenance.update({
                "handoff_artifact_path": "alpha_stand.onnx",
                "handoff_artifact_sha256": POLLEN_ARTIFACT_SHA256["alpha_stand.onnx"],
            })
        recipe = {
            "runner": RUNNER,
            "model": MODEL,
            "scene": SCENE,
            "start": deepcopy(START),
            "scenario": "oneshot_zero",
            # duration_s remains the runner's full rollout horizon. The
            # explicit fields keep the upstream activation window distinct
            # from the registry-owned recovery/evaluation tail.
            "duration_s": capture_duration,
            "command_duration_s": command_duration,
            "post_command_settle_s": recovery_tail,
            "capture_duration_s": capture_duration,
            "checks": checks,
            "action_scale": 1.0,
            "chain": bool(manifest.get("chain", False)),
            "provenance": provenance,
        }
        if handoff is not None:
            recipe["handoff"] = handoff
        return recipe

    if artifact_path == "alpha_sitstand.onnx":
        command = manifest.get("command")
        ramp_s = manifest.get("ramp_s")
        unwind_s = manifest.get("unwind_s")
        if (
            manifest.get("kind") != "scripted"
            or not isinstance(command, dict)
            or command.get("encoding") != "posture_flag"
            or command.get("slot") != "twist.vx"
            or command.get("sit") != 1.0
            or command.get("stand") != 0.0
            or not isinstance(ramp_s, (int, float))
            or not isinstance(unwind_s, (int, float))
            or not 0.0 < float(ramp_s)
            or not 0.0 < float(unwind_s)
        ):
            return None
        return {
            "runner": RUNNER,
            "model": MODEL,
            "scene": SCENE,
            "start": deepcopy(START),
            "scenario": "sitstand",
            "duration_s": float(ramp_s) + float(unwind_s),
            "hold_s": float(ramp_s),
            "checks": ["recover_upright"],
            "action_scale": 1.0,
            "provenance": _provenance(
                "Exact per-file Pollen schema-2 posture-flag manifest and the pinned sitstand timing contract",
                POLLEN_MANIFEST_URL,
                "Registry diagnostic that holds the manifest's sit timing then drives its declared rise/unwind timing; it does not reproduce the full daemon handoff or establish hardware verification.",
                policy_set_revision=POLLEN_POLICY_REVISION,
                manifest_sha256=POLLEN_MANIFEST_SHA256,
                artifact_path=artifact_path,
                command=command,
                ramp_s=float(ramp_s),
                unwind_s=float(unwind_s),
                action_scale=1.0,
                action_scale_source=UPSTREAM_CONTROL_URL,
            ),
        }
    return None


def _manifest_velocity_recipe(repo: str, manifest: dict[str, Any], source: dict[str, Any]) -> dict[str, Any] | None:
    expected = {
        "RemiFabre/microduck-rough-walk-e": {
            "revision": "fa7b27eeb5610d3b351362f4bd71691ee8be3d7d",
            "artifact_path": "policy.onnx",
            "artifact_sha256": "5aa423bd693e431b19e2ead77f99cbae6184e40a529eb2f7c1b4f85bb7f57040",
            "manifest_sha256": "f9b9cdbd7450de266ae1c7f6dd3ed1cc82fd5de01582bf073cc73d81cb2c0332",
        },
        "RemiFabre/microduck-rough-walk-g": {
            "revision": "242876a0aa8b40b702142fb0a5677fd43bc88a4c",
            "artifact_path": "policy.onnx",
            "artifact_sha256": "7a0d132f121d4bea3b713d3d7509500319389e0ac8de1ec9b390256471bbfc18",
            "manifest_sha256": "a304b650a9fe558eb054695654d2b2a346a2c246c05dd56f4524a1fff42174c6",
        },
        "HannesVonEssen/microduck-running": {
            "revision": "d839a07cd2cb4bdc2850ca72bf00d9b549ec600a",
            "artifact_path": "policy.onnx",
            "artifact_sha256": "007707dd7779b2756ded67c58b2e9f94fe5071794a48c2b5a20d5f8d841efbeb",
            "manifest_sha256": "7d70763e525e23d6c37b4f991be3732e2cd67be84f8c7c510ce4652cd63f1487",
        },
    }.get(repo)
    if expected is None:
        return None
    expected_source = {
        "provider": "huggingface-model",
        "repo": repo,
        "revision": expected["revision"],
        "artifact_path": expected["artifact_path"],
        "artifact_sha256": expected["artifact_sha256"],
        "manifest_path": "manifest.json",
        "manifest_sha256": expected["manifest_sha256"],
    }
    if not _source_matches(source, expected_source):
        return None
    robot = manifest.get("robot")
    command = manifest.get("command")
    if (
        manifest.get("kind") != "perpetual"
        or manifest.get("action_scale") != 1.0
        or manifest.get("entry_pose") != "standing"
        or not isinstance(robot, dict)
        or robot.get("model") != "microduck"
        or robot.get("control_hz") != 50
        or not isinstance(command, dict)
        or not isinstance(command.get("twist"), list)
    ):
        return None
    yaw = 0.0 if repo == "HannesVonEssen/microduck-running" else 0.5
    readme_url = f"https://huggingface.co/{repo}/blob/{expected['revision']}/README.md"
    return _velocity_recipe(
        model=MODEL,
        action_scale=1.0,
        yaw_rate=yaw,
        provenance=_provenance(
            "Exact pinned Hugging Face manifest and publisher command contract",
            readme_url,
            "Finite flat-v1 velocity diagnostic using the registry runner; rough-terrain and high-speed publisher evaluations remain publisher claims.",
            revision=expected["revision"],
            manifest_sha256=expected["manifest_sha256"],
            artifact_path=expected["artifact_path"],
            command_semantics="twist = [vx, vy, wz] in the 61D command block; the registry uses a bounded diagnostic schedule rather than claiming the publisher's full envelope",
            command_schedule="idle 1s, forward 0.25m/s 3s, then forward 0.25m/s with a bounded yaw probe 2s" if yaw else "idle 1s followed by two forward 0.25m/s segments",
            action_scale=1.0,
        ),
    )


def _genesis_recipe(source: dict[str, Any]) -> dict[str, Any] | None:
    artifact_path = source.get("artifact_path")
    if not isinstance(artifact_path, str) or artifact_path not in GENESIS_ARTIFACT_SHA256:
        return None
    expected = {
        "provider": "github",
        "repo": GENESIS_REPO,
        "revision": GENESIS_REVISION,
        "artifact_path": artifact_path,
        "artifact_sha256": GENESIS_ARTIFACT_SHA256[artifact_path],
        "manifest_path": None,
        "manifest_sha256": None,
    }
    if not _source_matches(source, expected):
        return None
    contract = _execution_contract(1.0)
    return _velocity_recipe(
        model=MODEL,
        action_scale=1.0,
        contract=contract,
        provenance=_provenance(
            "Exact pinned Genesis export plus its published 61D/14D/50Hz velocity contract",
            f"https://github.com/{GENESIS_REPO}/blob/{GENESIS_REVISION}/SIM2REAL.md",
            "Finite flat-v1 registry diagnostic of a policy exported from the Genesis port; this does not reproduce its Genesis terrain/actuator evaluation or establish hardware evidence.",
            revision=GENESIS_REVISION,
            artifact_path=artifact_path,
            command_semantics="twist = [vx, vy, wz] with the source's velocity-commanded walking contract",
            command_schedule="idle 1s, forward 0.25m/s 3s, forward 0.25m/s plus yaw 0.5rad/s 2s",
            action_scale=1.0,
            contract_source=f"https://github.com/{GENESIS_REPO}/blob/{GENESIS_REVISION}/microduck/velocity_cfg.py",
        ),
    )


def _jump_recipe(source: dict[str, Any]) -> dict[str, Any] | None:
    if not _source_matches(source, JUMP_SOURCE):
        return None
    contract = _execution_contract(1.0)
    return {
        "runner": RUNNER,
        "model": MODEL,
        "scene": SCENE,
        "start": deepcopy(START),
        "scenario": "oneshot_zero",
        "duration_s": 2.0,
        "checks": ["no_fall", "ends_upright"],
        "action_scale": 1.0,
        "contract": contract,
        "provenance": _provenance(
            "Exact pinned jump artifact and the publisher's browser/runtime jump contract",
            f"https://github.com/{JUMP_SOURCE['repo']}/blob/{JUMP_SOURCE['revision']}/app/src/game/constants.js",
            "Registry diagnostic rollout of the primary jump ONNX under flat-v1; publisher fall recovery and browser hand-back are not simulated, and this establishes no hardware verification.",
            revision=JUMP_SOURCE["revision"],
            artifact_path=JUMP_SOURCE["artifact_path"],
            command=[0.0, 0.0, 0.0],
            command_semantics="Policy selection is the trigger; the publisher's jump controller receives zero-padded command slots.",
            duration_s=2.0,
            action_scale=1.0,
            contract_source=f"https://github.com/{JUMP_SOURCE['repo']}/blob/{JUMP_SOURCE['revision']}/app/src/game/constants.js",
        ),
    }


def _max_height_jump_recipe(source: dict[str, Any]) -> dict[str, Any] | None:
    if not _source_matches(source, MAX_HEIGHT_JUMP_SOURCE):
        return None
    contract = _execution_contract(1.0)
    return {
        "runner": RUNNER,
        "model": MODEL,
        "scene": SCENE,
        "start": deepcopy(START),
        "scenario": "oneshot_trigger",
        "duration_s": 1.0,
        "trigger_s": 0.75,
        "checks": ["takeoff", "touchdown_after_takeoff"],
        "action_scale": 1.0,
        "contract": contract,
        "provenance": _provenance(
            "Exact pinned jump artifact, publisher README, and its handoff manifest",
            f"https://github.com/{MAX_HEIGHT_JUMP_SOURCE['repo']}/blob/{MAX_HEIGHT_JUMP_SOURCE['revision']}/README.md",
            "Primary jump-policy diagnostic only; the separately hashed standing handoff is intentionally not run as part of this entry, and fixed-timer clearing is an explicit unvalidated fallback rather than a claim of deployment equivalence.",
            revision=MAX_HEIGHT_JUMP_SOURCE["revision"],
            artifact_path=MAX_HEIGHT_JUMP_SOURCE["artifact_path"],
            launch_command=[1.0, 0.0, 0.0],
            settle_command=[0.0, 0.0, 0.0],
            trigger_s=0.75,
            action_scale=1.0,
            contract_source=f"https://github.com/{MAX_HEIGHT_JUMP_SOURCE['repo']}/blob/{MAX_HEIGHT_JUMP_SOURCE['revision']}/README.md",
            handoff_source=f"https://github.com/{MAX_HEIGHT_JUMP_SOURCE['repo']}/blob/{MAX_HEIGHT_JUMP_SOURCE['revision']}/handoff/manifest.json",
        ),
    }


def _generic_zero_recipe(manifest: dict[str, Any]) -> dict[str, Any] | None:
    """Cover only the documented, finite, constant zero-command one-shot."""

    if manifest.get("kind") != "episodic":
        return None
    command = manifest.get("command")
    if command is not None and not isinstance(command, dict):
        return None
    command = command or {}
    if command.get("encoding", "constant") not in (None, "constant"):
        return None
    if any(key in command for key in ("twist", "head", "body", "sit", "stand", "slot", "period_s", "end_phase")):
        return None
    duration = _duration(manifest.get("duration_s"))
    if duration is None or manifest.get("obs_len") != 61 or manifest.get("action_len") != 14 or manifest.get("model_api") != 1:
        return None
    robot = manifest.get("robot")
    if not isinstance(robot, dict) or robot.get("model") != "microduck" or robot.get("control_hz") != 50:
        return None
    action_scale = manifest.get("action_scale")
    if isinstance(action_scale, bool) or not isinstance(action_scale, (int, float)) or not isfinite(float(action_scale)):
        return None
    if manifest.get("entry_pose") not in (None, "standing"):
        return None
    return {
        "runner": RUNNER,
        "model": MODEL,
        "scene": SCENE,
        "start": deepcopy(START),
        "scenario": "oneshot_zero",
        "duration_s": duration,
        "checks": ["no_fall", "ends_upright"],
        "provenance": {
            "owner": "uduck-registry-maintainers",
            "source": "Pollen robot cheatsheet: plain episodic skills use the all-zero command",
            "source_url": UPSTREAM_CHEATSHEET_URL,
            "upstream_pin": UPSTREAM_PIN,
            "command": [0.0, 0.0, 0.0],
            "command_semantics": "upstream documented default for a constant episodic skill with no publisher-specific command prose",
            "action_scale": float(action_scale),
            "entry_pose_assumption": "settled_standing registry start; manifest entry_pose is standing or absent",
            "scope": "Registry diagnostic rollout under flat-v1 settled_standing; this does not establish intended-task success or hardware evidence.",
        },
    }


def _flamingo_recipe() -> dict[str, Any]:
    return {
        "runner": RUNNER,
        "model": MODEL,
        "scene": SCENE,
        "start": deepcopy(START),
        "scenario": "command_schedule",
        "duration_s": FLAMINGO_HOLD_S,
        "segments": [{"duration_s": FLAMINGO_HOLD_S, "command": list(FLAMINGO_COMMAND)}],
        "checks": ["no_fall"],
        "provenance": {
            "owner": "uduck-registry-maintainers",
            "source": "Pollen robot cheatsheet: sudo robotctl policy add flamingo RemiFabre/microduck-flamingo-cycle --hold 5 --command 1,1,0",
            "source_url": UPSTREAM_CHEATSHEET_URL,
            "upstream_pin": UPSTREAM_PIN,
            "manifest_url": UPSTREAM_MANIFEST_URL,
            "source_fixture": "simulation/tests/fixtures/flamingo-manifest.json",
            "command": list(FLAMINGO_COMMAND),
            "command_semantics": "[flag, side, 0]; flag=1 requests one-foot mode and side=+1 keeps the right foot down",
            "hold_s": FLAMINGO_HOLD_S,
            "duration_s": FLAMINGO_HOLD_S,
            "runner": RUNNER,
            "scene": SCENE,
            "start": deepcopy(START),
            "manifest_idle_command": [0.0, 0.0, 0.0],
            "scope": "Five second active-command uDuck diagnostic under flat-v1 settled_standing with the documented [1,1,0] hold. The manifest is perpetual and has no unwind_s, so no unwind or handoff is simulated. This is not publisher eval reproduction and establishes no hardware verification.",
            "limitations": "Stability under the documented command only; not one-foot-task success. See manifest eval object for publisher claims.",
        },
    }


def recipe_for_policy(repo: str, manifest: dict[str, Any] | None, source: dict[str, Any] | None = None) -> dict[str, Any] | None:
    """Return a reviewed recipe only for an exact source/manifest match."""

    if not isinstance(repo, str):
        return None
    if repo.casefold() == FLAMINGO_REPO.casefold() and isinstance(manifest, dict) and manifest.get("name") == FLAMINGO_NAME and source is not None and all(source.get(key) == value for key, value in FLAMINGO_SOURCE.items()):
        return _flamingo_recipe()
    if source is not None:
        if manifest is not None:
            official = _official_recipe(manifest, source)
            if official is not None:
                return official
            community = _manifest_velocity_recipe(repo, manifest, source)
            if community is not None:
                return community
        genesis = _genesis_recipe(source)
        if genesis is not None:
            return genesis
        jump = _jump_recipe(source)
        if jump is not None:
            return jump
        max_height_jump = _max_height_jump_recipe(source)
        if max_height_jump is not None:
            return max_height_jump
    return _generic_zero_recipe(manifest) if isinstance(manifest, dict) else None


def recipe_reason(repo: str, manifest: dict[str, Any] | None, source: dict[str, Any] | None = None) -> str:
    """Explain why no registry-owned execution recipe applies."""

    if repo.casefold() == FLAMINGO_REPO.casefold():
        if not isinstance(manifest, dict) or manifest.get("name") != FLAMINGO_NAME:
            return "The reviewed Flamingo recipe is bound to manifest name flamingo-cycle."
        if source is None or not all(source.get(key) == value for key, value in FLAMINGO_SOURCE.items()):
            return "The reviewed Flamingo recipe is bound to its pinned revision and manifest/artifact hashes."
    if not isinstance(manifest, dict):
        return "No machine-readable policy manifest is published with this artifact."
    if manifest.get("kind") == "perpetual":
        return "Perpetual policies require a maintainer-reviewed activation command and finite hold window."
    if manifest.get("kind") == "scripted":
        return "Scripted policies require daemon-driven command timing that the registry runner does not reproduce."
    if manifest.get("kind") == "episodic" and manifest.get("duration_s") is None:
        return "Episodic policy does not declare a finite duration."
    if isinstance(manifest.get("command"), dict) and manifest["command"].get("encoding") not in (None, "constant"):
        return "The upstream command encoding is daemon-driven and has no registry recipe."
    return "No maintainer-owned registry recipe covers this manifest."
