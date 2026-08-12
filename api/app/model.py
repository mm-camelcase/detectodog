from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path

import numpy as np
import onnxruntime as ort
from PIL import Image


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
MODEL_PATH = Path(os.getenv("MODEL_PATH", str(REPOSITORY_ROOT / "model/detectodog.onnx")))
LABELS_PATH = Path(os.getenv("LABELS_PATH", str(REPOSITORY_ROOT / "model/breeds.json")))
MEAN = np.asarray([0.485, 0.456, 0.406], dtype=np.float32).reshape(1, 1, 3)
STD = np.asarray([0.229, 0.224, 0.225], dtype=np.float32).reshape(1, 1, 3)


@lru_cache(maxsize=1)
def load_labels() -> list[dict[str, str]]:
    labels = json.loads(LABELS_PATH.read_text(encoding="utf-8"))
    if len(labels) != 120:
        raise RuntimeError(f"Expected 120 labels, found {len(labels)}")
    return labels


@lru_cache(maxsize=1)
def load_session() -> ort.InferenceSession:
    options = ort.SessionOptions()
    options.intra_op_num_threads = int(os.getenv("ORT_INTRA_OP_THREADS", "2"))
    options.inter_op_num_threads = 1
    options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    return ort.InferenceSession(
        str(MODEL_PATH),
        sess_options=options,
        providers=["CPUExecutionProvider"],
    )


def preprocess(image: Image.Image) -> np.ndarray:
    resized = image.convert("RGB").resize((300, 300), Image.Resampling.BILINEAR)
    pixels = np.asarray(resized, dtype=np.float32) / 255.0
    normalized = (pixels - MEAN) / STD
    return np.transpose(normalized, (2, 0, 1))[np.newaxis, ...].astype(np.float32)


def predict(image: Image.Image, top_k: int = 3) -> list[dict[str, object]]:
    logits = load_session().run(["logits"], {"image": preprocess(image)})[0][0]
    shifted = logits - np.max(logits)
    probabilities = np.exp(shifted) / np.exp(shifted).sum()
    indices = np.argsort(probabilities)[-top_k:][::-1]
    labels = load_labels()
    return [
        {
            "breed_id": labels[int(index)]["id"],
            "breed": labels[int(index)]["name"],
            "confidence": round(float(probabilities[index]), 4),
        }
        for index in indices
    ]
