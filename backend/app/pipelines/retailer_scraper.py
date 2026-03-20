"""
Pipeline: Amazon ASIN discovery + future retailer price integration.

Currently:
  - Discovers Amazon ASINs via UPC lookup (upcitemdb.com free API)
  - Upgrades Amazon affiliate links from search URLs to direct product links

Retailer price scraping (Target, Walmart, Best Buy) is not yet implemented —
these sites require JavaScript rendering that httpx+BeautifulSoup cannot handle.
Prices from those retailers will be added when:
  - Amazon PA-API access is obtained (after 3 qualifying affiliate sales)
  - A headless browser (Playwright) or price comparison API is integrated

Scheduled separately from the LEGO.com price scraper.
"""
from __future__ import annotations

import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

import httpx
from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Offer as OfferModel, Set as SetModel

logger = logging.getLogger("bricktrack.pipeline.retailer_scraper")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

AMAZON_TAG = os.getenv("AMAZON_AFFILIATE_TAG", "bricktrack-20")

REQUEST_TIMEOUT = 15.0
MAX_SETS_PER_RUN = 150


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_active_sets(db: Session) -> list[dict]:
    """Return active sets (current year ± 1) with UPC data for ASIN lookups.

    Prioritises sets whose Amazon offer has no ASIN yet.
    """
    from sqlalchemy import func, case
    from sqlalchemy.orm import aliased

    current_year = datetime.now().year
    amazon_offer = aliased(OfferModel)

    rows = db.execute(
        select(
            SetModel.set_num,
            SetModel.name,
            SetModel.barcode_upc,
            amazon_offer.asin,
        )
        .outerjoin(
            amazon_offer,
            and_(
                func.replace(SetModel.set_num, "-1", "") == amazon_offer.set_num,
                amazon_offer.store == "Amazon",
            ),
        )
        .where(
            SetModel.year >= current_year - 1,
            SetModel.year <= current_year + 1,
            SetModel.barcode_upc.isnot(None),
        )
        .order_by(
            # Sets without ASIN first
            case((amazon_offer.asin.is_(None), 0), else_=1),
            SetModel.year.desc(),
            SetModel.set_num.asc(),
        )
        .limit(MAX_SETS_PER_RUN)
    ).all()

    result = []
    for set_num, name, upc, existing_asin in rows:
        if existing_asin:
            continue  # Already have ASIN, skip
        plain = set_num.split("-")[0] if set_num else set_num
        result.append({
            "set_num": set_num,
            "set_num_plain": plain,
            "name": name or "",
            "upc": upc,
        })
    return result


def _upsert_offer(
    db: Session,
    set_num_plain: str,
    store: str,
    price: Optional[float],
    currency: str,
    url: str,
    in_stock: Optional[bool],
    asin: Optional[str] = None,
) -> str:
    """Insert or update an offer row. Match by (set_num, store).

    Returns "inserted", "updated", or "unchanged".
    """
    now = datetime.now(timezone.utc)

    existing = db.execute(
        select(OfferModel).where(
            and_(
                OfferModel.set_num == set_num_plain,
                OfferModel.store == store,
            )
        )
    ).scalar_one_or_none()

    if existing:
        changed = False
        # Only update price if we got a real one — never null out existing
        if price is not None and existing.price != price:
            existing.price = price
            changed = True
        if url and existing.url != url:
            existing.url = url
            changed = True
        if in_stock is not None and existing.in_stock != in_stock:
            existing.in_stock = in_stock
            changed = True
        if asin and existing.asin != asin:
            existing.asin = asin
            changed = True
        existing.currency = currency
        existing.last_checked = now
        return "updated" if changed else "unchanged"
    else:
        db.add(OfferModel(
            set_num=set_num_plain,
            store=store,
            price=price,
            currency=currency,
            url=url,
            in_stock=in_stock,
            asin=asin,
            last_checked=now,
        ))
        return "inserted"


# ---------------------------------------------------------------------------
# Amazon ASIN Discovery
# ---------------------------------------------------------------------------

def _discover_asin(
    client: httpx.Client,
    set_num_plain: str,
    upc: Optional[str],
) -> Optional[str]:
    """Discover an Amazon ASIN for a LEGO set via UPC lookup.

    Uses the free UPCitemdb.com API (100 lookups/day) to convert UPC -> ASIN.
    Returns the ASIN string or None.
    """
    if not upc:
        return None

    try:
        resp = client.get(
            f"https://api.upcitemdb.com/prod/trial/lookup?upc={quote(upc)}",
            headers={"Accept": "application/json"},
            timeout=10.0,
        )
        if resp.status_code != 200:
            return None

        data = resp.json()
        items = data.get("items", [])
        if not items:
            return None

        # Look for an Amazon offer in the first item
        for offer in items[0].get("offers", []):
            domain = offer.get("domain", "")
            link = offer.get("link", "")
            if "amazon.com" in domain and link:
                asin_match = re.search(r"/dp/([A-Z0-9]{10})", link)
                if asin_match:
                    return asin_match.group(1)

        # Also check the asin field directly if present
        for item in items:
            asin = item.get("asin", "")
            if asin and len(asin) == 10:
                return asin

    except (httpx.HTTPError, ValueError, KeyError):
        logger.debug("ASIN lookup failed for UPC %s", upc)

    return None


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_retailer_scrape() -> dict:
    """
    Main pipeline: discover Amazon ASINs for sets with UPC barcodes.

    Upgrades Amazon affiliate links from search URLs to direct product links,
    which improves click-through rates and user experience.

    Called by:
    - APScheduler (every 8 hours)
    - POST /admin/pipelines/retailer_scrape/run
    """
    logger.info("Starting retailer scrape (ASIN discovery)...")
    t0 = time.time()

    db = SessionLocal()
    stats = {
        "sets_checked": 0,
        "asins_discovered": 0,
        "offers_updated": 0,
    }

    try:
        active_sets = _get_active_sets(db)
        logger.info("Found %d sets needing ASIN discovery", len(active_sets))

        if not active_sets:
            stats["completed_at"] = datetime.now(timezone.utc).isoformat()
            return stats

        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            for s in active_sets:
                plain = s["set_num_plain"]
                upc = s["upc"]

                stats["sets_checked"] += 1

                asin = _discover_asin(client, plain, upc)
                if asin:
                    # Build direct product URL with affiliate tag
                    direct_url = f"https://www.amazon.com/dp/{quote(asin)}?tag={quote(AMAZON_TAG)}"
                    action = _upsert_offer(
                        db, plain, "Amazon",
                        None,  # No price without PA-API
                        "USD",
                        direct_url,
                        None,
                        asin=asin,
                    )
                    db.commit()
                    stats["asins_discovered"] += 1
                    if action in ("inserted", "updated"):
                        stats["offers_updated"] += 1

                    logger.debug("Found ASIN %s for set %s", asin, plain)

                # Rate limit UPC API (free tier: 100/day)
                time.sleep(1.0)

                # Cap at 90 lookups per run to stay under daily limit
                if stats["sets_checked"] >= 90:
                    logger.info("Hit ASIN discovery daily limit cap (90)")
                    break

        elapsed = time.time() - t0
        stats["elapsed_seconds"] = round(elapsed, 1)
        stats["completed_at"] = datetime.now(timezone.utc).isoformat()
        logger.info("Retailer scrape complete: %s", stats)
        return stats

    except Exception:
        db.rollback()
        logger.exception("Retailer scrape failed")
        return {"error": "scrape_failed", "completed_at": datetime.now(timezone.utc).isoformat()}
    finally:
        db.close()
