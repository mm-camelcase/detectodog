"""Build a reproducible, attributed dog/not-dog image manifest."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import random
import re
import tarfile
import time
from pathlib import Path

import httpx
from PIL import Image


ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
OXFORD_URL = "https://www.robots.ox.ac.uk/~vgg/data/pets/data/images.tar.gz"
COMMONS_API = "https://commons.wikimedia.org/w/api.php"
ALLOWED_LICENSES = ("cc by", "cc0", "public domain")
USER_AGENT = "DetectoDogResearch/1.0 (markmitchell451@gmail.com)"


def safe_name(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def valid_image(path: Path) -> bool:
    try:
        with Image.open(path) as image:
            image.verify()
        return True
    except (OSError, ValueError):
        path.unlink(missing_ok=True)
        return False


def download(client: httpx.Client, url: str, path: Path) -> None:
    if path.exists() and path.stat().st_size:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".part")
    for attempt in range(5):
        try:
            with client.stream("GET", url) as response:
                response.raise_for_status()
                with temporary.open("wb") as output:
                    for chunk in response.iter_bytes():
                        output.write(chunk)
            break
        except httpx.HTTPError:
            temporary.unlink(missing_ok=True)
            if attempt == 4:
                raise
            time.sleep(2 ** attempt)
    temporary.replace(path)


def extract_stanford(archive: Path, manifest: list[dict[str, str]], limit: int) -> None:
    destination = DATA / "stanford-dogs"
    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive) as source:
        members = [m for m in source.getmembers() if m.isfile() and m.name.lower().endswith((".jpg", ".jpeg", ".png"))]
        random.Random(42).shuffle(members)
        for member in members[:limit]:
            digest = hashlib.sha256(member.name.encode()).hexdigest()[:16]
            target = destination / f"{digest}.jpg"
            if not target.exists():
                extracted = source.extractfile(member)
                if extracted:
                    target.write_bytes(extracted.read())
            if valid_image(target):
                manifest.append({"path": str(target.relative_to(ROOT)), "label": "dog", "source": "stanford-dogs", "group": member.name.split("/")[1], "licence": "research dataset; verify original image rights", "source_url": "http://vision.stanford.edu/aditya86/ImageNetDogs/"})


def extract_oxford(archive: Path, manifest: list[dict[str, str]], limit_each: int) -> None:
    destination = DATA / "oxford-pets"
    destination.mkdir(parents=True, exist_ok=True)
    dog_breeds = {"american_bulldog", "american_pit_bull_terrier", "basset_hound", "beagle", "boxer", "chihuahua", "english_cocker_spaniel", "english_setter", "german_shorthaired", "great_pyrenees", "havanese", "japanese_chin", "keeshond", "leonberger", "miniature_pinscher", "newfoundland", "pomeranian", "pug", "saint_bernard", "samoyed", "scottish_terrier", "shiba_inu", "staffordshire_bull_terrier", "wheaten_terrier", "yorkshire_terrier"}
    selected = {"dog": 0, "not_dog": 0}
    with tarfile.open(archive) as source:
        members = [m for m in source.getmembers() if m.isfile() and m.name.lower().endswith(".jpg")]
        random.Random(43).shuffle(members)
        for member in members:
            stem = Path(member.name).stem
            breed = re.sub(r"_\d+$", "", stem).lower()
            label = "dog" if breed in dog_breeds else "not_dog"
            if selected[label] >= limit_each:
                continue
            digest = hashlib.sha256(member.name.encode()).hexdigest()[:16]
            target = destination / f"{digest}.jpg"
            if not target.exists():
                extracted = source.extractfile(member)
                if extracted:
                    target.write_bytes(extracted.read())
            if valid_image(target):
                selected[label] += 1
                manifest.append({"path": str(target.relative_to(ROOT)), "label": label, "source": "oxford-pets", "group": breed, "licence": "CC BY-SA 4.0", "source_url": "https://www.robots.ox.ac.uk/~vgg/data/pets/"})
            if all(value >= limit_each for value in selected.values()):
                break


def commons_files(client: httpx.Client, category: str, limit: int) -> list[dict[str, str]]:
    results: list[dict[str, str]] = []
    continuation: dict[str, str] = {}
    while len(results) < limit:
        params = {"action": "query", "format": "json", "generator": "search", "gsrsearch": category, "gsrnamespace": "6", "gsrlimit": "50", "prop": "imageinfo", "iiprop": "url|mime|extmetadata", "iiurlwidth": "800", **continuation}
        payload = None
        for attempt in range(5):
            response = client.get(COMMONS_API, params=params)
            if response.is_success and "json" in response.headers.get("content-type", ""):
                payload = response.json()
                break
            time.sleep(2 ** attempt)
        if payload is None:
            break
        for page in payload.get("query", {}).get("pages", {}).values():
            info = (page.get("imageinfo") or [{}])[0]
            metadata = info.get("extmetadata", {})
            licence = metadata.get("LicenseShortName", {}).get("value", "")
            title = page.get("title", "")
            lowered = f"{title} {metadata.get('ImageDescription', {}).get('value', '')}".lower()
            if info.get("mime") not in {"image/jpeg", "image/png"} or not any(item in licence.lower() for item in ALLOWED_LICENSES) or any(word in lowered for word in (" dog", "puppy", "canine")):
                continue
            results.append({"url": info.get("thumburl", info["url"]), "source_url": info.get("descriptionurl", ""), "licence": licence, "artist": metadata.get("Artist", {}).get("value", ""), "title": title})
            if len(results) >= limit:
                break
        continuation = payload.get("continue", {})
        if not continuation:
            break
    return results


def acquire_commons(client: httpx.Client, categories: list[str], manifest: list[dict[str, str]], limit_each: int) -> None:
    for category in categories:
        destination = DATA / "wikimedia" / safe_name(category)
        def acquire(item: dict[str, str]) -> dict[str, str] | None:
            suffix = ".png" if item["url"].lower().split("?")[0].endswith(".png") else ".jpg"
            digest = hashlib.sha256(item["url"].encode()).hexdigest()[:20]
            target = destination / f"{digest}{suffix}"
            try:
                download(client, item["url"], target)
            except httpx.HTTPError:
                return None
            if valid_image(target):
                return {"path": str(target.relative_to(ROOT)), "label": "not_dog", "source": "wikimedia-commons", "group": category, "licence": item["licence"], "source_url": item["source_url"], "artist": item["artist"], "title": item["title"]}
            return None

        with ThreadPoolExecutor(max_workers=4) as executor:
            manifest.extend(row for row in executor.map(acquire, commons_files(client, category, limit_each)) if row)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--stanford-archive", type=Path, required=True)
    parser.add_argument("--stanford-limit", type=int, default=3000)
    parser.add_argument("--oxford-limit-each", type=int, default=1800)
    parser.add_argument("--commons-limit-each", type=int, default=100)
    parser.add_argument("--skip-oxford", action="store_true", help="Build a smaller preliminary dataset while the Oxford archive is unavailable.")
    args = parser.parse_args()
    DATA.mkdir(parents=True, exist_ok=True)
    manifest: list[dict[str, str]] = []
    with httpx.Client(headers={"User-Agent": USER_AGENT}, follow_redirects=True, timeout=60) as client:
        extract_stanford(args.stanford_archive, manifest, args.stanford_limit)
        if not args.skip_oxford:
            oxford = DATA / "downloads" / "oxford-pets-images.tar.gz"
            download(client, OXFORD_URL, oxford)
            extract_oxford(oxford, manifest, args.oxford_limit_each)
        categories = json.loads((ROOT / "categories.json").read_text())
        acquire_commons(client, categories, manifest, args.commons_limit_each)
    random.Random(44).shuffle(manifest)
    (DATA / "manifest.jsonl").write_text("".join(json.dumps(row, ensure_ascii=False) + "\n" for row in manifest), encoding="utf-8")
    counts = {label: sum(row["label"] == label for row in manifest) for label in ("dog", "not_dog")}
    print(json.dumps({"images": len(manifest), "counts": counts}, indent=2))


if __name__ == "__main__":
    main()
