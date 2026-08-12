import io

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app


client = TestClient(app)


def test_health() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["breeds"] == 120


def test_rejects_non_image() -> None:
    response = client.post("/v1/predict", files={"image": ("note.txt", b"hello", "text/plain")})
    assert response.status_code == 415


def test_rejects_invalid_image_bytes() -> None:
    response = client.post("/v1/predict", files={"image": ("dog.jpg", b"nope", "image/jpeg")})
    assert response.status_code == 400


def make_image() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (32, 32), "goldenrod").save(buffer, format="JPEG")
    return buffer.getvalue()
