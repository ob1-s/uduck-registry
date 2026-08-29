#!/usr/bin/env python3
"""
ONNX static safety check — op allowlist + graph-size caps.

Runs BEFORE any MuJoCo rollout. A policy that uses ops outside the allowlist,
exceeds graph-size caps, or embeds external references must fail fast in the
sandboxed PR job (no secrets, no network, untrusted code path).
"""
import sys
import json
import onnx

# Only ops a locomotion policy should ever need (matmul-family, elementwise,
# activations, normalization, shape gymnastics). Everything else fails.
OP_ALLOWLIST = {
    "Add", "Sub", "Mul", "Div", "Neg", "Abs", "Sign", "Exp", "Log", "Sqrt",
    "Sin", "Cos", "Tanh", "Sigmoid", "Relu", "LeakyRelu", "Elu", "Erf", "Min",
    "Max", "Clip", "MatMul", "Gemm", "Transpose", "Reshape", "Concat",
    "Slice", "Gather", "Unsqueeze", "Squeeze", "Cast", "Identity",
    "ReduceMean", "ReduceSum", "ReduceMax", "Flatten", "Shape", "Constant",
    "ConstantOfShape", "Split", "Pow", "Where", "Range", "Tile",
    "BatchNormalization", "LayerNormalization", "InstanceNormalization",
}

MAX_NODES = 5_000
MAX_INITIALIZERS = 2_000
MAX_WEIGHT_BYTES = 256 * 1024 * 1024  # 256 MiB of parameters max
MAX_INPUT_DIMS = 61  # observation contract

# Ops that can execute arbitrary code / reach the filesystem / network.
FORBIDDEN_OPS = {
    "Custom", "CustomKernel", "Loop", "If", "Compress", "STFT", "LpNormalization",
}
# onnx external-data references let a model load arbitrary files.
EXTERNAL_DATA_FIELDS = {"external_data", "location"}


ALLOWED_METADATA_KEYS = {
    "run_path", "joint_names", "joint_stiffness", "joint_damping",
    "default_joint_pos", "command_names", "observation_names", "action_scale",
}

def check(path: str) -> list[str]:
    errors: list[str] = []
    try:
        model = onnx.load(path, load_external_data=False)
    except Exception as e:
        return [f"cannot parse ONNX model: {e}"]

    # External data check: in onnx >=1.12, per-tensor data_location==1 means EXTERNAL
    # plus optional model-level external_data (older). Handle both.
    try:
        if hasattr(model, "external_data") and getattr(model, "external_data"):
            # model-level external_data is rare; treat as error
            errors.append("model references external data files — not allowed")
    except Exception:
        pass
    for init in model.graph.initializer:
        # data_location: 0=DEFAULT, 1=EXTERNAL
        if getattr(init, "data_location", 0) == 1:
            errors.append(f"initializer '{init.name}' uses external data — not allowed")
        if getattr(init, "external_data", None):
            # repeated field; if any entries with key == "location"
            for ext in init.external_data:
                if getattr(ext, "key", "") == "location":
                    errors.append(f"initializer '{init.name}' references external location {ext.value}")

    # Embedded metadata: allow known training export keys, reject unknown
    for prop in model.metadata_props:
        if prop.key not in ALLOWED_METADATA_KEYS:
            errors.append(f"unexpected metadata entry: {prop.key}")

    graph = model.graph
    ops = set()
    for node in graph.node:
        ops.add(node.op_type)
        if node.op_type in FORBIDDEN_OPS:
            errors.append(f"forbidden op: {node.op_type}")

    for op in ops - OP_ALLOWLIST:
        errors.append(f"op '{op}' is not on the allowlist")

    if len(graph.node) > MAX_NODES:
        errors.append(f"graph has {len(graph.node)} nodes (max {MAX_NODES})")

    init_bytes = sum(max(1, len(init.raw_data)) for init in graph.initializer)
    if init_bytes > MAX_WEIGHT_BYTES:
        errors.append(f"initializers total {init_bytes} bytes (max {MAX_WEIGHT_BYTES})")

    # Observation contract: first input must be the 61-D observation.
    inputs = [i for i in graph.input if i.name not in {init.name for init in graph.initializer}]
    if inputs:
        dims = [d.dim_value for d in inputs[0].type.tensor_type.shape.dim]
        if dims and dims[0] not in (MAX_INPUT_DIMS, -1, 1):
            errors.append(f"expected first input dim 61 (obs contract), got {dims}")

    return errors


if __name__ == "__main__":
    failures = 0
    for p in sys.argv[1:]:
        errs = check(p)
        if errs:
            failures += 1
            print(f"FAIL {p}")
            for e in errs:
                print(f"  - {e}")
        else:
            print(f"OK   {p}")
    sys.exit(1 if failures else 0)
