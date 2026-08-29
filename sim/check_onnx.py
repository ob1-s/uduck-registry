#!/usr/bin/env python3
"""
ONNX static safety check — op allowlist + graph-size caps.

Runs BEFORE any MuJoCo rollout. A policy that uses ops outside the allowlist,
exceeds graph-size caps, or embeds external references must fail fast in the
sandboxed PR job (no secrets, no network, untrusted code path).
"""
import sys
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
OBSERVATION_SHAPE = [1, 61]
ACTION_SHAPE = [1, 14]
EXPECTED_TENSOR_DTYPE = onnx.TensorProto.FLOAT  # float32

# Ops that can execute arbitrary code / reach the filesystem / network.
FORBIDDEN_OPS = {
    "Custom", "CustomKernel", "Loop", "If", "Compress", "STFT", "LpNormalization",
}
# onnx external-data references let a model load arbitrary files.
ALLOWED_METADATA_KEYS = {
    "run_path", "joint_names", "joint_stiffness", "joint_damping",
    "default_joint_pos", "command_names", "observation_names", "action_scale",
}


def _tensor_shape(value_info) -> list[int | None] | None:
    """Return a concrete tensor shape, or None for a non-tensor/dynamic shape."""
    if not value_info.type.HasField("tensor_type"):
        return None
    tensor_type = value_info.type.tensor_type
    if not tensor_type.HasField("shape"):
        return None
    shape: list[int | None] = []
    for dim in tensor_type.shape.dim:
        if dim.HasField("dim_value"):
            shape.append(int(dim.dim_value))
        else:
            # Symbolic and anonymous dimensions are not acceptable for a fixed
            # robot control interface.
            shape.append(None)
    return shape


def _dtype_name(value_info) -> str:
    if not value_info.type.HasField("tensor_type"):
        return "non-tensor"
    return onnx.TensorProto.DataType.Name(value_info.type.tensor_type.elem_type)


def _check_interface(value_info, role: str, expected_shape: list[int]) -> list[str]:
    errors: list[str] = []
    shape = _tensor_shape(value_info)
    if shape != expected_shape:
        errors.append(
            f"{role} '{value_info.name}' must have shape {expected_shape}, got {shape}"
        )
    if (
        not value_info.type.HasField("tensor_type")
        or value_info.type.tensor_type.elem_type != EXPECTED_TENSOR_DTYPE
    ):
        errors.append(
            f"{role} '{value_info.name}' must have dtype FLOAT (float32), "
            f"got {_dtype_name(value_info)}"
        )
    return errors


_ELEMENT_BYTES = {
    onnx.TensorProto.FLOAT: 4,
    onnx.TensorProto.FLOAT16: 2,
    onnx.TensorProto.DOUBLE: 8,
    onnx.TensorProto.INT64: 8,
    onnx.TensorProto.INT32: 4,
    onnx.TensorProto.INT16: 2,
    onnx.TensorProto.INT8: 1,
    onnx.TensorProto.UINT64: 8,
    onnx.TensorProto.UINT32: 4,
    onnx.TensorProto.UINT16: 2,
    onnx.TensorProto.UINT8: 1,
    onnx.TensorProto.BOOL: 1,
}


def _initializer_bytes(initializer) -> int:
    if initializer.raw_data:
        return len(initializer.raw_data)
    element_bytes = _ELEMENT_BYTES.get(initializer.data_type)
    if element_bytes is None:
        return MAX_WEIGHT_BYTES + 1
    elements = 1
    for dim in initializer.dims:
        elements *= int(dim)
    return elements * element_bytes

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
        if op not in FORBIDDEN_OPS:
            errors.append(f"op '{op}' is not on the allowlist")

    if len(graph.node) > MAX_NODES:
        errors.append(f"graph has {len(graph.node)} nodes (max {MAX_NODES})")

    if len(graph.initializer) > MAX_INITIALIZERS:
        errors.append(
            f"graph has {len(graph.initializer)} initializers (max {MAX_INITIALIZERS})"
        )

    init_bytes = sum(_initializer_bytes(init) for init in graph.initializer)
    if init_bytes > MAX_WEIGHT_BYTES:
        errors.append(f"initializers total {init_bytes} bytes (max {MAX_WEIGHT_BYTES})")

    # A policy is a single, fixed-shape float32 function. Do not allow an
    # extra input/output or a dynamic dimension to reach onnxruntime.
    initializer_names = {init.name for init in graph.initializer}
    inputs = [i for i in graph.input if i.name not in initializer_names]
    if len(inputs) != 1:
        errors.append(f"graph must have exactly one runtime input, got {len(inputs)}")
    else:
        errors.extend(_check_interface(inputs[0], "input", OBSERVATION_SHAPE))

    if len(graph.output) != 1:
        errors.append(f"graph must have exactly one output, got {len(graph.output)}")
    else:
        errors.extend(_check_interface(graph.output[0], "output", ACTION_SHAPE))

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
