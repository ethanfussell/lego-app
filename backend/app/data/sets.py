# app/data/sets.py
"""
Fetch ONLY official LEGO retail sets from Rebrickable and cache them.
Filters out Gear, Books, Education kits, promos, service packs, etc.
"""

from app.core.env import get_env
from pathlib import Path
from typing import Dict, Any, List, Optional, Set
import json
import time
import re
import requests

# ---------- Config ----------
API_KEY = get_env("REBRICKABLE_API_KEY")
if not API_KEY:
    raise ValueError("Missing REBRICKABLE_API_KEY in .env")

SET_API = "https://rebrickable.com/api/v3/lego/sets/"
THEME_API = "https://rebrickable.com/api/v3/lego/themes/"
HEADERS = {"Authorization": f"key {API_KEY}"}

CACHE_FILE = Path(__file__).with_name("sets_cache.json")

# ---------- Exclusions ----------
# Root themes we want to skip entirely
EXCLUDE_THEME_ROOTS: Set[str] = {
    "Gear",
    "Books",
    "Key Chains",
    "Magnets",
    "Storage",
    "Accessories",
    "Bundles",
    "Education",
    "Other",
    "Promotional",
    "Collectable Minifigures",  # optional if you want to hide CMFs
    "LEGOLAND",
    "Games (Non-Lego Board)",
    "Powered UP Accessories",
    "DUPLO Education",
}

# Keywords in set names to skip (case-insensitive)
NAME_KEYWORDS = [
    "key chain", "keychain", "magnet", "book", "magazine", "poster",
    "watch", "alarm clock", "pen", "eraser", "storage", "service pack",
    "spare parts", "supplementary", "accessory", "light kit",
    "minifigure display", "educator", "classroom", "education", "teacher",
    "bundle", "pack", "brick box", "activity", "promo", "polybag",
    "display case", "gear", "tape", "mosaic", "storage head"
]

SETNUM_PATTERN = re.compile(r"^\d{3,7}-\d+$")  # e.g. 10305-1


# ---------- Theme helpers ----------
def _fetch_all_themes() -> List[Dict[str, Any]]:
    url = f"{THEME_API}?page=1&page_size=1000"
    out: List[Dict[str, Any]] = []
    while url:
        resp = requests.get(url, headers=HEADERS, timeout=30)
        if resp.status_code != 200:
            raise RuntimeError(f"Themes API error {resp.status_code}: {resp.text}")
        data = resp.json()
        out.extend(data.get("results", []))
        url = data.get("next")
    return out


def _build_theme_index(themes: List[Dict[str, Any]]) -> Dict[int, Dict[str, Any]]:
    return {t["id"]: t for t in themes}


def _root_theme_name(theme_id: Optional[int], index: Dict[int, Dict[str, Any]]) -> Optional[str]:
    """Find top-level theme name for a set."""
    if theme_id is None:
        return None
    seen = set()
    current = index.get(theme_id)
    while current and current.get("parent_id") and current["id"] not in seen:
        seen.add(current["id"])
        current = index.get(current["parent_id"])
    return (current or {}).get("name")


# ---------- Filters ----------
def _is_name_blocked(name: str) -> bool:
    low = name.lower()
    return any(kw in low for kw in NAME_KEYWORDS)


def _looks_like_real_set(set_num: Optional[str]) -> bool:
    return bool(set_num and SETNUM_PATTERN.match(set_num))


def _map_set(item: Dict[str, Any], theme_root: Optional[str]) -> Optional[Dict[str, Any]]:
    set_num = item.get("set_num")
    name = item.get("name") or ""
    if not _looks_like_real_set(set_num):
        return None
    if theme_root in EXCLUDE_THEME_ROOTS:
        return None
    if _is_name_blocked(name):
        return None
    if item.get("num_parts", 0) < 20:
        # skip micro promos and bags
        return None

    set_num_plain = set_num.split("-")[0]
    return {
        "set_num": set_num,
        "set_num_plain": set_num_plain,
        "name": name,
        "year": item.get("year"),
        "pieces": item.get("num_parts"),
        "theme": theme_root,
        "image_url": item.get("set_img_url"),
    }


# ---------- Public ----------
def fetch_all_lego_sets(page_size: int = 1000, throttle: float = 0.2) -> List[Dict[str, Any]]:
    print("🔄 Fetching themes…")
    themes = _fetch_all_themes()
    theme_index = _build_theme_index(themes)
    print(f"✅ Loaded {len(themes)} themes")

    url = f"{SET_API}?page=1&page_size={page_size}"
    curated: List[Dict[str, Any]] = []
    kept = 0

    print("🔄 Fetching sets…")
    while url:
        resp = requests.get(url, headers=HEADERS, timeout=45)
        if resp.status_code != 200:
            raise RuntimeError(f"Sets API error {resp.status_code}: {resp.text}")
        data = resp.json()

        for raw in data.get("results", []):
            root_name = _root_theme_name(raw.get("theme_id"), theme_index)
            mapped = _map_set(raw, root_name)
            if mapped:
                curated.append(mapped)
                kept += 1

        url = data.get("next")
        if url:
            time.sleep(throttle)

    CACHE_FILE.write_text(json.dumps(curated, indent=2, ensure_ascii=False))
    print(f"✅ Saved {len(curated)} official LEGO sets → {CACHE_FILE}")
    return curated


def load_cached_sets() -> List[Dict[str, Any]]:
    if not CACHE_FILE.exists():
        print("⚠️ Cache not found — run fetch_all_lego_sets() first.")
        return []
    try:
        return json.loads(CACHE_FILE.read_text())
    except json.JSONDecodeError:
        print("⚠️ Cache corrupted — returning empty list.")
        return []


def cache_count() -> int:
    return len(load_cached_sets())


def get_set_by_num(set_num: str) -> Optional[Dict[str, Any]]:
    sets = load_cached_sets()
    needle = (set_num or "").strip().lower()
    for s in sets:
        if s.get("set_num", "").lower() == needle or s.get("set_num_plain", "").lower() == needle:
            return s
    return None


# ---------- CLI ----------
if __name__ == "__main__":
    fetch_all_lego_sets(page_size=1000, throttle=0.2)
    print(f"🧱 Final curated cache: {cache_count()} sets")
    for s in load_cached_sets()[:5]:
        print(f"→ {s['set_num']} [{s.get('theme')}]: {s['name']}")