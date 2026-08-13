"""Evaluate the frozen dog-detector experiment on its held-out split."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import onnxruntime as ort
from sklearn.metrics import classification_report, confusion_matrix, roc_auc_score


HERE = Path(__file__).resolve().parent
RUN = HERE / "runs" / "dog-detector-1.0"


def main() -> None:
    stored = np.load(RUN / "features.npz", allow_pickle=True)
    test = stored["splits"] == "test"
    features, labels = stored["features"][test], stored["labels"][test]
    metadata = json.loads((RUN / "metadata.json").read_text())
    session = ort.InferenceSession(str(RUN / "dog-detector.onnx"), providers=["CPUExecutionProvider"])
    outputs = session.run(None, {"breed_logits": features.astype(np.float32)})
    probabilities = outputs[-1][:, 1]
    predicted = (probabilities >= metadata["threshold"]).astype(int)
    report = {"model_version": metadata["model_version"], "threshold": metadata["threshold"], "test_samples": int(len(labels)), "roc_auc": float(roc_auc_score(labels, probabilities)), "confusion_matrix": confusion_matrix(labels, predicted).tolist(), "classification_report": classification_report(labels, predicted, target_names=["not_dog", "dog"], output_dict=True)}
    (RUN / "evaluation.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
