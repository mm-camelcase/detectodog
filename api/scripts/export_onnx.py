"""Export the trained DetectoDog checkpoint and verify it with ONNX Runtime."""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch

from scripts.pytorch_model import load_pytorch_model


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("model/detectodog.onnx"))
    args = parser.parse_args()

    torch.manual_seed(42)
    model = load_pytorch_model()
    example = torch.rand(1, 3, 300, 300, dtype=torch.float32)
    args.output.parent.mkdir(parents=True, exist_ok=True)

    torch.onnx.export(
        model,
        (example,),
        args.output,
        input_names=["image"],
        output_names=["logits"],
        opset_version=18,
        dynamo=False,
        do_constant_folding=True,
    )

    graph = onnx.load(args.output)
    onnx.checker.check_model(graph)

    session = ort.InferenceSession(str(args.output), providers=["CPUExecutionProvider"])
    with torch.inference_mode():
        torch_logits = model(example).cpu().numpy()
    ort_logits = session.run(["logits"], {"image": example.numpy()})[0]

    max_difference = float(np.max(np.abs(torch_logits - ort_logits)))
    torch_top = np.argsort(torch_logits[0])[-3:][::-1].tolist()
    ort_top = np.argsort(ort_logits[0])[-3:][::-1].tolist()
    if torch_top != ort_top or max_difference > 1e-4:
        raise RuntimeError(
            f"ONNX parity failed: torch={torch_top}, onnx={ort_top}, max_diff={max_difference}"
        )

    print(f"Exported {args.output} ({args.output.stat().st_size / 1024 / 1024:.2f} MiB)")
    print(f"Parity passed: top3={torch_top}, max_abs_difference={max_difference:.8f}")


if __name__ == "__main__":
    main()
