# app/data/sets.py
"""
Handles fetching LEGO sets from the Rebrickable API and caching them locally.

- Uses REBRICKABLE_API_KEY from .env (via app.core.env.get_env)
- Fetches all *normal* LEGO sets (no MOCs, no books/gear/etc.)
- Looks up theme names via /api/v3/lego/themes/ and stores them
- Saves a simplified copy to sets_cache.json for faster local access
- Provides helpers for loading and looking up cached sets
"""

from ..core.env import get_env
from pathlib import Path
from typing import Any, Dict, List, Optional

import json
import time
import requests

# ----- Paths / Constants -----
CACHE_FILE = Path(__file__).with_name("sets_cache.json")

SETS_URL = "https://rebrickable.com/api/v3/lego/sets/"
THEMES_URL = "https://rebrickable.com/api/v3/lego/themes/"

API_KEY = get_env("REBRICKABLE_API_KEY")
if not API_KEY:
    raise ValueError("Missing REBRICKABLE_API_KEY in .env")

HEADERS = {"Authorization": f"key {API_KEY}"}


# ===== IP / FRANCHISE DETECTION =====

IP_KEYWORDS = [
    ("Star Wars", ["star wars"]),
    ("Marvel", ["marvel", "avengers", "iron man", "spider-man", "spiderman"]),
    ("DC", ["batman", "dc comics", "gotham"]),
    ("Harry Potter", ["harry potter", "hogwarts"]),
    ("Disney", ["disney", "frozen", "moana", "encanto", "princess"]),
    ("Minecraft", ["minecraft"]),
    ("Super Mario", ["mario", "super mario"]),
    # add more as you like
]


def infer_ip(name: str, theme_name: Optional[str] = None) -> Optional[str]:
    """
    Try to infer a more user-friendly IP/franchise (Star Wars, Marvel, etc.)
    using the set name + theme name.
    """
    text = f"{name} {theme_name or ''}".lower()
    for label, keywords in IP_KEYWORDS:
        if any(k in text for k in keywords):
            return label
    return None


# ===== Theme helpers =====

def fetch_all_themes(throttle: float = 0.2) -> Dict[int, str]:
    """
    Fetch all themes from Rebrickable and return a map {theme_id: theme_name}.
    There are only a couple hundred themes, so this is cheap.
    """
    theme_map: Dict[int, str] = {}
    url = f"{THEMES_URL}?page=1&page_size=1000"

    print("🔄 Fetching themes from Rebrickable...")

    while url:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        if resp.status_code != 200:
            raise RuntimeError(f"Themes API error {resp.status_code}: {resp.text}")

        data = resp.json()
        for t in data.get("results", []):
            tid = t.get("id")
            name = t.get("name")
            if isinstance(tid, int) and name:
                theme_map[tid] = name

        url = data.get("next")
        if url:
            time.sleep(throttle)

    print(f"✅ Loaded {len(theme_map)} themes")
    return theme_map


# ===== Set helpers =====

def _is_normal_lego_set(item: Dict[str, Any]) -> bool:
    """
    Filter out MOCs, books, gear, etc.

    Rebrickable's /sets/ includes:
      - set_type: "normal", "book", "gear", "moc", ...
    We only keep 'normal' sets with a positive piece count.
    """
    if item.get("set_type") != "normal":
        return False
    if (item.get("num_parts") or 0) <= 0:
        return False
    return True


def _map_set(item: Dict[str, Any], theme_map: Dict[int, str]) -> Dict[str, Any]:
    """
    Map a raw Rebrickable set dict to our internal shape.
    Uses theme_id → theme name from theme_map.
    """
    set_num = item.get("set_num")  # e.g. "10305-1"
    set_num_plain = set_num.split("-")[0] if set_num else None

    theme_id = item.get("theme_id")
    theme_name = theme_map.get(theme_id) if isinstance(theme_id, int) else None

    name = item.get("name") or ""

    # infer franchise/IP from name + theme_name
    ip = infer_ip(name, theme_name)

    return {
        "set_num": set_num,
        "set_num_plain": set_num_plain,
        "name": name,
        "year": item.get("year"),
        "pieces": item.get("num_parts"),
        "theme": theme_name,     # raw theme from Rebrickable (e.g. Seasonal)
        "ip": ip or theme_name,  # what we’ll actually *show* in the UI
        "image_url": item.get("set_img_url"),
    }


def _save_cache(rows: List[Dict[str, Any]]) -> None:
    """Save all sets to the JSON cache."""
    CACHE_FILE.write_text(json.dumps(rows, indent=2, ensure_ascii=False))


# ===== Public functions =====

def fetch_all_lego_sets(page_size: int = 1000, throttle: float = 0.2) -> List[Dict[str, Any]]:
    """
    Fetch all LEGO sets from Rebrickable and cache them locally.

    Args:
        page_size: Number of results per page (max 1000)
        throttle: Delay between API requests (seconds)

    Returns:
        List of mapped set dictionaries
    """
    # 1) Load themes first so we can attach nice names
    theme_map = fetch_all_themes(throttle=throttle)

    url = f"{SETS_URL}?page=1&page_size={page_size}"
    all_sets: List[Dict[str, Any]] = []

    print("🔄 Fetching LEGO sets from Rebrickable...")

    while url:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        if resp.status_code != 200:
            raise RuntimeError(f"Sets API error {resp.status_code}: {resp.text}")

        data = resp.json()
        for item in data.get("results", []):
            if not _is_normal_lego_set(item):
                continue
            # NOTE: pass theme_map here
            all_sets.append(_map_set(item, theme_map))

        url = data.get("next")
        if url:
            time.sleep(throttle)  # be polite to the API

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


def get_set_by_num(set_num: str) -> Optional[Dict[str, Any]]:
    """
    Look up a single LEGO set by full or plain set number (e.g. '10305' or '10305-1').
    Returns the matching dict or None if not found.
    """
    sets = load_cached_sets()
    set_num = set_num.strip().lower()

    for s in sets:
        if (
            (s.get("set_num") or "").lower() == set_num
            or (s.get("set_num_plain") or "").lower() == set_num
        ):
            return s
    return None


# ===== Manual Testing (Terminal entrypoint) =====

if __name__ == "__main__":
    # Rebuild cache (themes + sets), then show a few samples.
    fetch_all_lego_sets(page_size=1000, throttle=0.2)
    print(f"🧱 Cached sets: {cache_count()}")
    sample = load_cached_sets()[:5]
    for s in sample:
        print(f"→ {s['set_num']}: {s['name']}  [theme={s['theme']}]  [ip={s.get('ip')}]")