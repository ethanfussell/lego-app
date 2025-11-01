# app/data/sets.py
import os
import json
import time
from pathlib import Path
import requests

# Where we cache downloaded sets
CACHE_FILE = Path(__file__).with_name("sets_cache.json")

# Rebrickable API
API_URL = "https://rebrickable.com/api/v3/lego/sets/"
API_KEY = os.getenv("REBRICKABLE_API_KEY")
HEADERS = {"Authorization": f"key {API_KEY}"} if API_KEY else {}

def fetch_all_lego_sets(page_size: int = 1000, throttle: float = 0.2) -> None:
    """
    Fetch all sets from Rebrickable and save them into sets_cache.json.
    - Reads API key from REBRICKABLE_API_KEY
    - Paginates until 'next' is None
    - Maps fields into our app's shape
    """
    if not API_KEY:
        raise ValueError("Missing REBRICKABLE_API_KEY environment variable.")

    url = f"{API_URL}?page=1&page_size={page_size}"
    all_sets = []

    while url:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        if resp.status_code != 200:
            raise RuntimeError(f"Rebrickable {resp.status_code}: {resp.text}")

        data = resp.json()

        # ---- map Rebrickable fields into our schema ----
        for item in data.get("results", []):
            set_num = item.get("set_num")            # e.g. "10305-1"
            # Optional: store a plain number for easier searching like "10305"
            set_num_plain = set_num.split("-")[0] if set_num else None

            all_sets.append({
                "set_num": set_num,
                "set_num_plain": set_num_plain,
                "name": item.get("name"),
                "year": item.get("year"),
                "pieces": item.get("num_parts"),
                # Rebrickable returns theme_id; name needs a separate lookup.
                "theme": None,
                "image_url": item.get("set_img_url"),
            })

        # Next page (Rebrickable gives a full URL or None)
        url = data.get("next")
        # be polite to the API
        time.sleep(throttle)

    # Save cache
    CACHE_FILE.write_text(json.dumps(all_sets, indent=2, ensure_ascii=False))
    print(f"Fetched {len(all_sets)} sets → {CACHE_FILE}")

if __name__ == "__main__":
    fetch_all_lego_sets()