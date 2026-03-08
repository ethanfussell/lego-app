"""
Pipeline: Scrape BrickEconomy's "retiring soon" page and update Set.retirement_status.

Target URL: https://www.brickeconomy.com/sets/retiring-soon

Strategy:
1. Fetch the HTML page with httpx
2. Parse set numbers from URL patterns using BeautifulSoup
3. Update retirement_status='retiring_soon' and retirement_date on matching sets
"""
from __future__ import annotations

import logging
import re
import time
from datetime import datetime, timezone

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select

from app.db import SessionLocal
from app.models import Set as SetModel

logger = logging.getLogger("bricktrack.pipeline.retirement")

RETIRING_SOON_URL = "https://www.brickeconomy.com/sets/retiring-soon"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

REQUEST_TIMEOUT = 30.0

_MONTH_MAP = {
    "Jan": "01", "Feb": "02", "Mar": "03", "Apr": "04",
    "May": "05", "Jun": "06", "Jul": "07", "Aug": "08",
    "Sep": "09", "Oct": "10", "Nov": "11", "Dec": "12",
}


def _parse_retiring_sets(html: str) -> list[dict]:
    """
    Parse the BrickEconomy retiring soon page.

    Returns list of dicts:
      [{"set_num_plain": "10305", "retirement_date": "2026-12"}, ...]
    """
    soup = BeautifulSoup(html, "html.parser")
    results = []

    # BrickEconomy links follow /set/NNNNN-N/set-name
    for link in soup.find_all("a", href=True):
        href = link["href"]
        match = re.search(r"/set/(\d+)-\d+/", href)
        if not match:
            continue

        set_num_plain = match.group(1)

        # Try to find retirement date in nearby text
        parent = link.find_parent("tr") or link.find_parent("div")
        retirement_date = None
        if parent:
            text = parent.get_text()
            date_match = re.search(
                r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{4})",
                text,
            )
            if date_match:
                month = _MONTH_MAP.get(date_match.group(1), "12")
                year = date_match.group(2)
                retirement_date = f"{year}-{month}"

        results.append({
            "set_num_plain": set_num_plain,
            "retirement_date": retirement_date,
        })

    # Deduplicate
    seen: set[str] = set()
    deduped = []
    for r in results:
        if r["set_num_plain"] not in seen:
            seen.add(r["set_num_plain"])
            deduped.append(r)

    return deduped


def run_retirement_scrape() -> dict:
    """
    Scrape BrickEconomy for retiring soon sets and update the database.

    Called by:
    - APScheduler (daily at 4 AM UTC)
    - POST /admin/pipelines/retirement_scrape/run
    """
    logger.info("Starting retirement scrape from BrickEconomy...")
    t0 = time.time()

    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT, follow_redirects=True) as client:
            resp = client.get(RETIRING_SOON_URL, headers=HEADERS)
            resp.raise_for_status()

        retiring_sets = _parse_retiring_sets(resp.text)
        logger.info("Parsed %d retiring sets from BrickEconomy", len(retiring_sets))

        if not retiring_sets:
            logger.warning("No retiring sets found -- page structure may have changed")
            return {
                "scraped": 0,
                "matched": 0,
                "updated": 0,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            }

        db = SessionLocal()
        matched = 0
        updated = 0

        try:
            for entry in retiring_sets:
                plain = entry["set_num_plain"]
                # Try both "NNNNN-1" (Rebrickable format) and "NNNNN"
                for set_num in [f"{plain}-1", plain]:
                    row = db.execute(
                        select(SetModel).where(SetModel.set_num == set_num)
                    ).scalar_one_or_none()

                    if row is not None:
                        matched += 1
                        changed = False

                        if row.retirement_status != "retiring_soon":
                            row.retirement_status = "retiring_soon"
                            changed = True

                        if entry["retirement_date"] and row.retirement_date != entry["retirement_date"]:
                            row.retirement_date = entry["retirement_date"]
                            changed = True

                        if changed:
                            updated += 1
                        break

            db.commit()
        except Exception:
            db.rollback()
            raise
        finally:
            db.close()

        elapsed = time.time() - t0
        stats = {
            "scraped": len(retiring_sets),
            "matched": matched,
            "updated": updated,
            "elapsed_seconds": round(elapsed, 1),
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }
        logger.info("Retirement scrape complete: %s", stats)
        return stats

    except Exception:
        logger.exception("Retirement scrape failed")
        return {"error": "scrape_failed", "completed_at": datetime.now(timezone.utc).isoformat()}
