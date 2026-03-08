"""
Refresh the LEGO sets cache from Rebrickable and sync into the database.

Usage:
    cd backend
    python -m scripts.refresh_sets          # fetch from API + sync to DB
    python -m scripts.refresh_sets --skip-fetch   # sync existing cache to DB only
"""
from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# Ensure backend/ is on the path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.db import SessionLocal
from app.models import Set as SetModel, get_locked_fields
from app.data.sets import fetch_all_lego_sets, load_cached_sets


def sync_cache_to_db(skip_fetch: bool = False) -> dict:
    """
    1. Optionally fetch fresh data from Rebrickable API (updates sets_cache.json).
    2. Upsert every cached set into the `sets` DB table.

    Returns stats dict: {total, inserted, updated}.
    """
    if not skip_fetch:
        print("--- Fetching from Rebrickable API ---")
        fetch_all_lego_sets()

    cached = load_cached_sets()
    if not cached:
        print("No cached sets found. Nothing to sync.")
        return {"total": 0, "inserted": 0, "updated": 0}

    print(f"--- Syncing {len(cached)} cached sets to database ---")

    db = SessionLocal()
    now = datetime.now(timezone.utc)
    inserted = 0
    updated = 0

    try:
        # Load existing set_nums for fast lookup
        existing = {
            row.set_num: row
            for row in db.query(SetModel).all()
        }

        for s in cached:
            set_num = s.get("set_num")
            if not set_num:
                continue

            row = existing.get(set_num)

            if row is None:
                # New set — insert
                row = SetModel(
                    set_num=set_num,
                    name=s.get("name") or "",
                    year=s.get("year"),
                    theme=s.get("theme"),
                    pieces=s.get("pieces"),
                    image_url=s.get("image_url"),
                    ip=s.get("ip"),
                    first_seen_at=now,
                )
                db.add(row)
                inserted += 1
            else:
                # Existing set — update mutable fields (skip admin-locked)
                changed = False
                locked = set(get_locked_fields(row))
                for attr, key in [
                    ("name", "name"),
                    ("year", "year"),
                    ("theme", "theme"),
                    ("pieces", "pieces"),
                    ("image_url", "image_url"),
                    ("ip", "ip"),
                ]:
                    if attr in locked:
                        continue  # Skip admin-locked fields
                    new_val = s.get(key)
                    if getattr(row, attr) != new_val:
                        setattr(row, attr, new_val)
                        changed = True
                if changed:
                    updated += 1

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    stats = {"total": len(cached), "inserted": inserted, "updated": updated}
    print(f"Done: {stats['total']} total, {stats['inserted']} new, {stats['updated']} updated")
    return stats


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Refresh LEGO sets cache and sync to DB")
    parser.add_argument("--skip-fetch", action="store_true", help="Skip Rebrickable API fetch, sync existing cache only")
    args = parser.parse_args()

    t0 = time.time()
    stats = sync_cache_to_db(skip_fetch=args.skip_fetch)
    elapsed = time.time() - t0
    print(f"Completed in {elapsed:.1f}s")
