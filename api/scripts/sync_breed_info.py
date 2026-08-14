"""Create the local Dog API fallback used by the breed profile endpoint."""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from app.breed_info import normalise_breed


ALIASES = {
    "japanese-spaniel": "Japanese Chin", "pekinese": "Pekingese", "blenheim-spaniel": "Cavalier King Charles Spaniel",
    "toy-terrier": "Toy Fox Terrier", "basset": "Basset Hound", "bluetick": "Bluetick Coonhound",
    "walker-hound": "Treeing Walker Coonhound", "redbone": "Redbone Coonhound", "wire-haired-fox-terrier": "Wire Fox Terrier",
    "airedale": "Airedale Terrier", "cairn": "Cairn Terrier", "dandie-dinmont": "Dandie Dinmont Terrier",
    "boston-bull": "Boston Terrier", "scotch-terrier": "Scottish Terrier", "lhasa": "Lhasa Apso",
    "brittany-spaniel": "Brittany", "clumber": "Clumber Spaniel", "english-springer": "English Springer Spaniel",
    "groenendael": "Belgian Sheepdog", "malinois": "Belgian Malinois", "kelpie": "Australian Kelpie",
    "doberman": "Doberman Pinscher", "appenzeller": "Appenzeller Sennenhund", "entlebucher": "Entlebucher Mountain Dog",
    "eskimo-dog": "American Eskimo Dog", "malamute": "Alaskan Malamute", "leonberg": "Leonberger", "chow": "Chow Chow",
    "brabancon-griffon": "Brussels Griffon", "pembroke": "Pembroke Welsh Corgi", "cardigan": "Cardigan Welsh Corgi",
    "toy-poodle": "Poodle (Toy)", "miniature-poodle": "Poodle (Miniature)", "standard-poodle": "Poodle (Standard)",
    "mexican-hairless": "Xoloitzcuintli",
}


def key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.casefold().replace("dog", ""))


def fetch_page(page: int, size: int) -> list[dict[str, object]]:
    query = urlencode({"page[number]": page, "page[size]": size})
    request = Request(f"https://dogapi.dog/api/v2/breeds?{query}", headers={"Accept": "application/json", "User-Agent": "DetectoDog/2.0"})
    for attempt in range(5):
        try:
            with urlopen(request, timeout=20) as response:
                return json.load(response)["data"]
        except (HTTPError, URLError, TimeoutError, KeyError, ValueError):
            time.sleep(2 ** attempt)
    return []


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--labels", type=Path, default=Path("model/breeds.json"))
    parser.add_argument("--output", type=Path, default=Path("model/breed-info.json"))
    args = parser.parse_args()
    rows: list[dict[str, object]] = []
    for page in range(1, 7):
        batch = fetch_page(page, 50)
        if not batch:
            start = (page - 1) * 50 + 1
            for item_index in range(start, start + 50):
                batch.extend(fetch_page(item_index, 1))
        rows.extend(batch)
    unique = {str(row["id"]): row for row in rows}
    by_name = {key(str(row["attributes"]["name"])): row for row in unique.values()}
    output: dict[str, dict[str, object]] = {}
    for label in json.loads(args.labels.read_text(encoding="utf-8")):
        expected = ALIASES.get(label["id"], label["name"])
        item = by_name.get(key(expected))
        if item:
            output[label["id"]] = normalise_breed(item["attributes"], str(item["id"]))
    args.output.write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Matched {len(output)} of 120 breeds")


if __name__ == "__main__":
    main()
