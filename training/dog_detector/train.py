"""Train and export dog-detector-1.0 from breed-model logits."""

from __future__ import annotations

import json
import hashlib
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import precision_recall_curve, roc_auc_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from skl2onnx import convert_sklearn
from skl2onnx.common.data_types import FloatTensorType


ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
DATA = HERE / "data"
RUN = HERE / "runs" / "dog-detector-1.0"
MEAN = np.asarray([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 1, 3)
STD = np.asarray([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 1, 3)


def preprocess(path: Path) -> np.ndarray:
    with Image.open(path) as image:
        pixels = np.asarray(image.convert("RGB").resize((300, 300), Image.Resampling.BILINEAR), dtype=np.float32) / 255.0
    return np.transpose((pixels - MEAN) / STD, (2, 0, 1)).astype(np.float32)


def split(row: dict[str, str]) -> str:
    key = int.from_bytes(__import__("hashlib").sha256(f"{row['source']}:{row['group']}".encode()).digest()[:4], "big") % 100
    return "train" if key < 70 else "validation" if key < 85 else "test"


def main() -> None:
    RUN.mkdir(parents=True, exist_ok=True)
    manifest_bytes = (DATA / "manifest.jsonl").read_bytes()
    manifest_hash = hashlib.sha256(manifest_bytes).hexdigest()
    rows = [json.loads(line) for line in manifest_bytes.decode("utf-8").splitlines()]
    session = ort.InferenceSession(str(ROOT / "model" / "detectodog.onnx"), providers=["CPUExecutionProvider"])
    cache = RUN / "features.npz"
    stored = np.load(cache, allow_pickle=True) if cache.exists() else None
    if stored is not None and "manifest_hash" in stored and str(stored["manifest_hash"]) == manifest_hash:
        features, labels, splits = stored["features"], stored["labels"], stored["splits"]
    else:
        features, labels, splits = [], [], []
        for index, row in enumerate(rows, 1):
            try:
                logits = session.run(["logits"], {"image": preprocess(HERE / row["path"])[None, ...]})[0][0]
            except (OSError, ValueError):
                continue
            features.append(logits)
            labels.append(1 if row["label"] == "dog" else 0)
            splits.append(split(row))
            if index % 250 == 0:
                print(f"Features: {index}/{len(rows)}", flush=True)
        features, labels, splits = np.asarray(features, np.float32), np.asarray(labels), np.asarray(splits)
        np.savez_compressed(cache, features=features, labels=labels, splits=splits, manifest_hash=manifest_hash)
    train = splits == "train"
    validation = splits == "validation"
    model = Pipeline([("scale", StandardScaler()), ("classifier", LogisticRegression(C=0.1, class_weight="balanced", max_iter=2000, random_state=42))])
    model.fit(features[train], labels[train])
    probabilities = model.predict_proba(features[validation])[:, 1]
    precision, recall, thresholds = precision_recall_curve(labels[validation], probabilities)
    eligible = np.where(recall[:-1] >= 0.97)[0]
    threshold_index = eligible[np.argmax(precision[:-1][eligible])] if len(eligible) else int(np.argmax(precision[:-1] + recall[:-1]))
    threshold = float(thresholds[threshold_index])
    converted = convert_sklearn(model, initial_types=[("breed_logits", FloatTensorType([None, 120]))], target_opset=17, options={id(model.named_steps["classifier"]): {"zipmap": False}})
    (RUN / "dog-detector.onnx").write_bytes(converted.SerializeToString())
    metadata = {"model_version": "dog-detector-1.0", "input": "breed_logits", "threshold": threshold, "breed_model_version": "detectodog-1.0", "training_manifest_sha256": manifest_hash, "validation_roc_auc": float(roc_auc_score(labels[validation], probabilities)), "samples": {name: int(np.sum(splits == name)) for name in ("train", "validation", "test")}}
    (RUN / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n")
    print(json.dumps(metadata, indent=2))


if __name__ == "__main__":
    main()
