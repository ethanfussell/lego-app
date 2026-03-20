"""
Pipeline: Scrape retail prices and update the Offer table.

Sources:
  - LEGO.com: Official MSRP + stock status (JSON-LD structured data)
  - Amazon/Target/Walmart/Best Buy: Search URL construction (affiliate links, no price scraping)

Only processes "active" sets (current year +/- 1). Rate-limited to be polite.
"""
from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

import os

import httpx
from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Offer as OfferModel, Set as SetModel
from app.pipelines._scraper_utils import extract_jsonld_product_offer, SCRAPER_HEADERS

logger = logging.getLogger("bricktrack.pipeline.prices")

LEGO_PRODUCT_URL = "https://www.lego.com/en-us/product/"
AMAZON_TAG = os.getenv("AMAZON_AFFILIATE_TAG", "bricktrack-20")
WALMART_IMPACT_ID = os.getenv("WALMART_IMPACT_AFFILIATE_ID", "")
TARGET_IMPACT_ID = os.getenv("TARGET_IMPACT_AFFILIATE_ID", "")

HEADERS = SCRAPER_HEADERS

REQUEST_TIMEOUT = 20.0
THROTTLE_SECONDS = 2.0
MAX_SETS_PER_RUN = 200


def build_amazon_url(set_num_plain: str, name: str, asin: str | None = None) -> str:
    """Build an Amazon URL with affiliate tag. Uses direct product link if ASIN is available."""
    if asin:
        return f"https://www.amazon.com/dp/{quote(asin)}?tag={quote(AMAZON_TAG)}"
    query = f"LEGO {set_num_plain} {name}"
    return f"https://www.amazon.com/s?k={quote(query)}&tag={quote(AMAZON_TAG)}"


def build_target_url(set_num_plain: str) -> str:
    base = f"https://www.target.com/s?searchTerm=lego+{set_num_plain}"
    if TARGET_IMPACT_ID:
        return f"https://goto.target.com/c/{quote(TARGET_IMPACT_ID)}/1/2?u={quote(base)}"
    return base


def build_walmart_url(set_num_plain: str) -> str:
    base = f"https://www.walmart.com/search?q=lego+{set_num_plain}"
    if WALMART_IMPACT_ID:
        return f"https://goto.walmart.com/c/{quote(WALMART_IMPACT_ID)}/1/2?u={quote(base)}"
    return base


def build_bestbuy_url(set_num_plain: str) -> str:
    return f"https://www.bestbuy.com/site/searchpage.jsp?st=lego+{set_num_plain}"


def scrape_lego_product_page(
    client: httpx.Client,
    set_num_plain: str,
) -> Optional[dict]:
    """
    Scrape a LEGO.com product page for price and availability via JSON-LD.

    Returns {"price": float, "currency": str, "in_stock": bool|None, "url": str}
    or None if unavailable.
    """
    url = f"{LEGO_PRODUCT_URL}{set_num_plain}"

    try:
        resp = client.get(url, headers=HEADERS, follow_redirects=True)
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
    except httpx.HTTPError:
        logger.debug("Failed to fetch LEGO.com page for %s", set_num_plain)
        return None

    result = extract_jsonld_product_offer(resp.text)
    if result:
        result["url"] = str(resp.url)
        return result

    return None


def _get_active_sets(db: Session) -> list[dict]:
    """Get sets from current year +/- 1 to scrape prices for.

    Prioritises sets that have never been checked (no LEGO offer) or were
    checked the longest time ago, so that every eligible set is eventually
    reached across successive runs.
    """
    current_year = datetime.now().year

    # Left-join to the LEGO offer so we can sort by last_checked (NULL first)
    from sqlalchemy import func, case
    from sqlalchemy.orm import aliased

    lego_offer = aliased(OfferModel)

    rows = db.execute(
        select(SetModel.set_num, SetModel.name, SetModel.year)
        .outerjoin(
            lego_offer,
            and_(
                func.replace(SetModel.set_num, "-1", "") == lego_offer.set_num,
                lego_offer.store == "LEGO",
            ),
        )
        .where(
            SetModel.year >= current_year - 1,
            SetModel.year <= current_year + 1,
        )
        .order_by(
            # Never-checked sets first, then oldest-checked first
            case((lego_offer.last_checked.is_(None), 0), else_=1),
            lego_offer.last_checked.asc(),
            SetModel.year.desc(),
            SetModel.set_num.asc(),
        )
        .limit(MAX_SETS_PER_RUN)
    ).all()

    result = []
    for set_num, name, year in rows:
        plain = set_num.split("-")[0] if set_num else set_num
        result.append({
            "set_num": set_num,
            "set_num_plain": plain,
            "name": name or "",
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
) -> bool:
    """
    Insert or update an offer row. Match by (set_num, store).
    Returns True if new row inserted.
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
        if price is not None:
            existing.price = price
        existing.currency = currency
        existing.url = url
        if in_stock is not None:
            existing.in_stock = in_stock
        existing.last_checked = now
        return False
    else:
        db.add(OfferModel(
            set_num=set_num_plain,
            store=store,
            price=price,
            currency=currency,
            url=url,
            in_stock=in_stock,
            last_checked=now,
        ))
        return True


def run_price_scrape() -> dict:
    """
    Main pipeline: scrape LEGO.com prices + generate retailer URLs.

    Called by:
    - APScheduler (every 6 hours)
    - POST /admin/pipelines/price_scrape/run
    """
    logger.info("Starting price scrape...")
    t0 = time.time()

    db = SessionLocal()
    stats = {"sets_processed": 0, "offers_inserted": 0, "offers_updated": 0, "lego_prices_found": 0}

    try:
        active_sets = _get_active_sets(db)
        logger.info("Will process %d active sets", len(active_sets))

        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            for s in active_sets:
                plain = s["set_num_plain"]
                name = s["name"]
                full_set_num = s["set_num"]

                stats["sets_processed"] += 1

                # --- LEGO.com ---
                lego_data = scrape_lego_product_page(client, plain)

                if lego_data and lego_data.get("price"):
                    stats["lego_prices_found"] += 1

                    is_new = _upsert_offer(
                        db, plain, "LEGO",
                        lego_data["price"],
                        lego_data.get("currency", "USD"),
                        lego_data["url"],
                        lego_data.get("in_stock"),
                    )
                    if is_new:
                        stats["offers_inserted"] += 1
                    else:
                        stats["offers_updated"] += 1

                    # Also update Set.retail_price
                    set_row = db.execute(
                        select(SetModel).where(SetModel.set_num == full_set_num)
                    ).scalar_one_or_none()
                    if set_row:
                        set_row.retail_price = lego_data["price"]
                        set_row.retail_currency = lego_data.get("currency", "USD")

                # --- Retailer search URLs ---
                retailers = [
                    ("Amazon", build_amazon_url(plain, name)),
                    ("Target", build_target_url(plain)),
                    ("Walmart", build_walmart_url(plain)),
                    ("Best Buy", build_bestbuy_url(plain)),
                ]
                for store, url in retailers:
                    is_new = _upsert_offer(db, plain, store, None, "USD", url, None)
                    if is_new:
                        stats["offers_inserted"] += 1
                    else:
                        stats["offers_updated"] += 1

                # Commit per-set to avoid losing progress
                db.commit()

                # Rate limit LEGO.com
                time.sleep(THROTTLE_SECONDS)

        elapsed = time.time() - t0
        stats["elapsed_seconds"] = round(elapsed, 1)
        stats["completed_at"] = datetime.now(timezone.utc).isoformat()
        logger.info("Price scrape complete: %s", stats)
        return stats

    except Exception:
        db.rollback()
        logger.exception("Price scrape failed")
        return {"error": "scrape_failed", "completed_at": datetime.now(timezone.utc).isoformat()}
    finally:
        db.close()
