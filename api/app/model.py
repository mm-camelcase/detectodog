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
DETECTOR_PATH = Path(os.getenv("DETECTOR_PATH", str(REPOSITORY_ROOT / "model/dog-detector.onnx")))
DETECTOR_CONFIG_PATH = Path(os.getenv("DETECTOR_CONFIG_PATH", str(REPOSITORY_ROOT / "model/dog-detector.json")))
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


@lru_cache(maxsize=1)
def load_detector_session() -> ort.InferenceSession:
    return ort.InferenceSession(str(DETECTOR_PATH), providers=["CPUExecutionProvider"])


@lru_cache(maxsize=1)
def load_detector_config() -> dict[str, object]:
    return json.loads(DETECTOR_CONFIG_PATH.read_text(encoding="utf-8"))


def preprocess(image: Image.Image) -> np.ndarray:
    resized = image.convert("RGB").resize((300, 300), Image.Resampling.BILINEAR)
    pixels = np.asarray(resized, dtype=np.float32) / 255.0
    normalized = (pixels - MEAN) / STD
    return np.transpose(normalized, (2, 0, 1))[np.newaxis, ...].astype(np.float32)


def predict_with_dog_gate(image: Image.Image, top_k: int = 3) -> tuple[list[dict[str, object]], float]:
    logits = load_session().run(["logits"], {"image": preprocess(image)})[0][0]
    detector_outputs = load_detector_session().run(None, {"breed_logits": logits[np.newaxis, ...].astype(np.float32)})
    probabilities_output = next((output for output in detector_outputs if isinstance(output, np.ndarray) and output.ndim == 2 and output.shape[1] == 2), None)
    if probabilities_output is None:
        raise RuntimeError("Dog detector did not return two-class probabilities")
    dog_probability = float(probabilities_output[0][1])
    shifted = logits - np.max(logits)
    probabilities = np.exp(shifted) / np.exp(shifted).sum()
    indices = np.argsort(probabilities)[-top_k:][::-1]
    labels = load_labels()
    matches = [
        {
            "breed_id": labels[int(index)]["id"],
            "breed": labels[int(index)]["name"],
            "confidence": round(float(probabilities[index]), 4),
        }
        for index in indices
    ]
    return matches, dog_probability


def predict(image: Image.Image, top_k: int = 3) -> list[dict[str, object]]:
    """Return breed matches for model evaluation and backwards-compatible callers."""
    return predict_with_dog_gate(image, top_k)[0]
