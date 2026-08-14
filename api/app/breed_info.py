from __future__ import annotations

import json
import os
from functools import lru_cache
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
BREED_INFO_PATH = Path(os.getenv("BREED_INFO_PATH", str(REPOSITORY_ROOT / "model/breed-info.json")))
DOG_API_URL = os.getenv("DOG_API_URL", "https://dogapi.dog/api/v2")
DOG_API_TIMEOUT_SECONDS = float(os.getenv("DOG_API_TIMEOUT_SECONDS", "3"))


@lru_cache(maxsize=1)
def load_breed_info() -> dict[str, dict[str, object]]:
    return json.loads(BREED_INFO_PATH.read_text(encoding="utf-8"))


def normalise_breed(attributes: dict[str, object], dog_api_id: str) -> dict[str, object]:
    life = attributes.get("life") or {}
    male_weight = attributes.get("male_weight") or {}
    female_weight = attributes.get("female_weight") or {}
    male_height = attributes.get("male_height") or {}
    female_height = attributes.get("female_height") or {}
    origin = attributes.get("origin") or {}
    coat = attributes.get("coat") or {}
    traits = attributes.get("traits") or {}
    images = attributes.get("images") or []
    image = images[0] if images else {}

    def combined_range(first: dict[str, object], second: dict[str, object]) -> dict[str, object]:
        minimums = [value for value in (first.get("min"), second.get("min")) if isinstance(value, (int, float))]
        maximums = [value for value in (first.get("max"), second.get("max")) if isinstance(value, (int, float))]
        return {"min": min(minimums) if minimums else None, "max": max(maximums) if maximums else None}

    return {
        "dog_api_id": dog_api_id,
        "name": attributes.get("name"),
        "description": attributes.get("description"),
        "life_years": {"min": life.get("min"), "max": life.get("max")},
        "weight_kg": combined_range(male_weight, female_weight),
        "height_cm": combined_range(male_height, female_height),
        "origin": {"country": origin.get("country"), "region": origin.get("region")},
        "coat": {"type": coat.get("type"), "length": coat.get("length"), "colors": coat.get("colors") or []},
        "hypoallergenic": attributes.get("hypoallergenic"),
        "traits": {
            "energy": traits.get("energy"),
            "grooming": traits.get("grooming"),
            "trainability": traits.get("trainability"),
            "exercise_minutes": traits.get("exercise_minutes"),
            "temperament": traits.get("temperament") or [],
        },
        "image_url": image.get("medium") or image.get("thumb"),
        "image_attribution": image.get("attribution") or {},
        "provider": "Stratonauts Dog API",
        "provider_url": "https://dogapi.dog/",
    }


def fetch_live_breed(dog_api_id: str) -> dict[str, object] | None:
    request = Request(
        f"{DOG_API_URL}/breeds/{dog_api_id}",
        headers={"Accept": "application/json", "User-Agent": "DetectoDog/2.0"},
    )
    try:
        with urlopen(request, timeout=DOG_API_TIMEOUT_SECONDS) as response:
            payload = json.load(response)
        item = payload["data"]
        return normalise_breed(item["attributes"], item["id"])
    except (HTTPError, URLError, TimeoutError, KeyError, ValueError):
        return None


@lru_cache(maxsize=120)
def get_breed_info(breed_id: str) -> dict[str, object] | None:
    stored = load_breed_info().get(breed_id)
    if not stored:
        return None
    live = fetch_live_breed(str(stored["dog_api_id"]))
    return live or stored
