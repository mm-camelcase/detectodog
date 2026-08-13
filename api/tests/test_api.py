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


def matches(confidence: float = 0.8) -> list[dict[str, object]]:
    return [
        {"breed_id": "labrador-retriever", "breed": "Labrador Retriever", "confidence": confidence},
        {"breed_id": "golden-retriever", "breed": "Golden Retriever", "confidence": 0.1},
        {"breed_id": "chesapeake-bay-retriever", "breed": "Chesapeake Bay Retriever", "confidence": 0.05},
    ]


def test_returns_no_dog_state(monkeypatch) -> None:
    monkeypatch.setattr("app.main.predict_with_dog_gate", lambda _image: (matches(0.07), 0.08))
    monkeypatch.setattr("app.main.load_detector_config", lambda: {"model_version": "dog-detector-test", "threshold": 0.5})
    response = client.post("/v1/predict", files={"image": ("sky.jpg", make_image(), "image/jpeg")})
    assert response.status_code == 200
    assert response.json()["prediction_quality"] == "not_dog"
    assert response.json()["dog_probability"] == 0.08


def test_returns_breed_for_detected_dog(monkeypatch) -> None:
    monkeypatch.setattr("app.main.predict_with_dog_gate", lambda _image: (matches(), 0.94))
    monkeypatch.setattr("app.main.load_detector_config", lambda: {"model_version": "dog-detector-test", "threshold": 0.5})
    response = client.post("/v1/predict", files={"image": ("dog.jpg", make_image(), "image/jpeg")})
    assert response.status_code == 200
    assert response.json()["prediction_quality"] == "good"
    assert response.json()["matches"][0]["breed"] == "Labrador Retriever"
