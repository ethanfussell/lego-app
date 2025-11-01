# app/data/sets.py
"""
Handles fetching LEGO sets from the Rebrickable API and caching them locally.
- Uses REBRICKABLE_API_KEY from .env (via app.core.env.get_env)
- Paginates through results automatically
- Saves a simplified copy to sets_cache.json for faster local access
- Provides helpers for loading and counting cached sets
"""

from app.core.env import get_env
import json
import time
from pathlib import Path
import requests
from typing import List, Dict, Any

# ----- Paths / Constants -----
CACHE_FILE = Path(__file__).with_name("sets_cache.json")
API_URL = "https://rebrickable.com/api/v3/lego/sets/"
API_KEY = get_env("REBRICKABLE_API_KEY")

if not API_KEY:
    raise ValueError("Missing REBRICKABLE_API_KEY in .env")

HEADERS = {"Authorization": f"key {API_KEY}"}


# ----- Helpers -----
def _map_set(item: Dict[str, Any]) -> Dict[str, Any]:
    """Convert a Rebrickable set record into our app's format."""
    set_num = item.get("set_num")  # e.g. "10305-1"
    set_num_plain = set_num.split("-")[0] if set_num else None

    return {
        "set_num": set_num,
        "set_num_plain": set_num_plain,
        "name": item.get("name"),
        "year": item.get("year"),
        "pieces": item.get("num_parts"),
        "theme": None,  # optional future enhancement via /themes API
        "image_url": item.get("set_img_url"),
    }


def _save_cache(rows: List[Dict[str, Any]]) -> None:
    """Save all sets to the JSON cache."""
    CACHE_FILE.write_text(json.dumps(rows, indent=2, ensure_ascii=False))


# ----- Main Public Functions -----
def fetch_all_lego_sets(page_size: int = 1000, throttle: float = 0.2) -> List[Dict[str, Any]]:
    """
    Fetch all LEGO sets from Rebrickable and cache them locally.

    Args:
        page_size: Number of results per page (max 1000)
        throttle: Delay between API requests (seconds)
    Returns:
        List of mapped set dictionaries
    """
    url = f"{API_URL}?page=1&page_size={page_size}"
    all_sets: List[Dict[str, Any]] = []

    print("🔄 Fetching LEGO sets from Rebrickable...")

    while url:
        response = requests.get(url, headers=HEADERS, timeout=30)
        if response.status_code != 200:
            raise RuntimeError(f"Rebrickable API error {response.status_code}: {response.text}")

        data = response.json()
        for item in data.get("results", []):
            all_sets.append(_map_set(item))

        url = data.get("next")
        if url:
            time.sleep(throttle)  # avoid rate limits

    _save_cache(all_sets)
    print(f"✅ Saved {len(all_sets)} sets → {CACHE_FILE}")
    return all_sets


def load_cached_sets() -> List[Dict[str, Any]]:
    """Load cached sets from sets_cache.json (or empty list if missing)."""
    if not CACHE_FILE.exists():
        print("⚠️ Cache not found — run fetch_all_lego_sets() first.")
        return []
    try:
        return json.loads(CACHE_FILE.read_text())
    except json.JSONDecodeError:
        print("⚠️ Cache corrupted — returning empty list.")
        return []


def cache_count() -> int:
    """Return how many sets are currently cached."""
    return len(load_cached_sets())

def get_set_by_num(set_num: str) -> dict | None:
    """
    Look up a single LEGO set by full or plain set number (e.g. '10305' or '10305-1').
    Returns the matching dict or None if not found.
    """
    sets = load_cached_sets()
    set_num = set_num.strip().lower()

    for s in sets:
        if (
            s.get("set_num", "").lower() == set_num
            or s.get("set_num_plain", "").lower() == set_num
        ):
            return s
    return None

# ----- Manual Testing (Terminal entrypoint) -----
if __name__ == "__main__":
    # Uncomment this line to fetch and rebuild cache:
    # fetch_all_lego_sets(page_size=1000, throttle=0.2)

    # Or just inspect existing cache:
    print(f"🧱 Cached sets: {cache_count()}")
    sample = load_cached_sets()[:5]
    for s in sample:
        print(f"→ {s['set_num']}: {s['name']}")