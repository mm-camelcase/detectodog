from __future__ import annotations

import io
import os

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum
from PIL import Image, UnidentifiedImageError

from .model import load_labels, predict


MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", str(2 * 1024 * 1024)))
MODEL_VERSION = os.getenv("MODEL_VERSION", "detectodog-1.0")
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

app = FastAPI(title="DetectoDog API", version="1.0.0", docs_url=None, redoc_url=None)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin for origin in os.getenv("ALLOWED_ORIGINS", "*").split(",")],
    allow_methods=["GET", "POST"],
    allow_headers=["content-type"],
)


@app.get("/health")
def health() -> dict[str, object]:
    return {"status": "ok", "model_version": MODEL_VERSION, "breeds": len(load_labels())}


@app.post("/v1/predict")
async def classify(image: UploadFile = File(...)) -> dict[str, object]:
    if image.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=415, detail="Upload a JPEG, PNG, or WebP image.")

    payload = await image.read(MAX_IMAGE_BYTES + 1)
    if len(payload) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image must be smaller than 2 MB.")

    try:
        photo = Image.open(io.BytesIO(payload))
        photo.verify()
        photo = Image.open(io.BytesIO(payload)).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise HTTPException(status_code=400, detail="The uploaded file is not a valid image.")

    matches = predict(photo)
    top_confidence = float(matches[0]["confidence"])
    quality = "good" if top_confidence >= 0.55 else "uncertain"
    return {
        "model_version": MODEL_VERSION,
        "prediction_quality": quality,
        "matches": matches,
        "disclaimer": "Visual estimate only; this is not a genetic test.",
    }


handler = Mangum(app, lifespan="off")
