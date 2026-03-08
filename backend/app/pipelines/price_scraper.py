"""
Pipeline: Scrape retail prices and update the Offer table.

Sources:
  - LEGO.com: Official MSRP + stock status (JSON-LD structured data)
  - Amazon/Target/Walmart: Search URL construction (affiliate links, no price scraping)

Only processes "active" sets (current year +/- 1). Rate-limited to be polite.
"""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Offer as OfferModel, Set as SetModel

logger = logging.getLogger("bricktrack.pipeline.prices")

LEGO_PRODUCT_URL = "https://www.lego.com/en-us/product/"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}

REQUEST_TIMEOUT = 20.0
THROTTLE_SECONDS = 2.0
MAX_SETS_PER_RUN = 100


def _build_amazon_url(set_num_plain: str, name: str) -> str:
    query = f"LEGO {set_num_plain} {name}"
    return f"https://www.amazon.com/s?k={quote(query)}"


def _build_target_url(set_num_plain: str) -> str:
    return f"https://www.target.com/s?searchTerm=lego+{set_num_plain}"


def _build_walmart_url(set_num_plain: str) -> str:
    return f"https://www.walmart.com/search?q=lego+{set_num_plain}"


def _scrape_lego_product_page(
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

    soup = BeautifulSoup(resp.text, "html.parser")

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue

        items = data if isinstance(data, list) else [data]

        for item in items:
            if not isinstance(item, dict) or item.get("@type") != "Product":
                continue

            offers = item.get("offers", {})
            if isinstance(offers, list):
                offers = offers[0] if offers else {}

            price = None
            currency = "USD"
            in_stock = None

            raw_price = offers.get("price")
            if isinstance(raw_price, (int, float)):
                price = float(raw_price)
            elif isinstance(raw_price, str):
                try:
                    price = float(raw_price)
                except ValueError:
                    pass

            if isinstance(offers.get("priceCurrency"), str):
                currency = offers["priceCurrency"]

            availability = str(offers.get("availability", ""))
            if "InStock" in availability:
                in_stock = True
            elif "OutOfStock" in availability:
                in_stock = False

            if price is not None:
                return {
                    "price": price,
                    "currency": currency,
                    "in_stock": in_stock,
                    "url": str(resp.url),
                }

    return None


def _get_active_sets(db: Session) -> list[dict]:
    """Get sets from current year +/- 1 to scrape prices for."""
    current_year = datetime.now().year

    rows = db.execute(
        select(SetModel.set_num, SetModel.name, SetModel.year)
        .where(
            SetModel.year >= current_year - 1,
            SetModel.year <= current_year + 1,
        )
        .order_by(SetModel.year.desc(), SetModel.set_num.asc())
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
                lego_data = _scrape_lego_product_page(client, plain)

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

                # --- Amazon ---
                amazon_url = _build_amazon_url(plain, name)
                is_new = _upsert_offer(db, plain, "Amazon", None, "USD", amazon_url, None)
                if is_new:
                    stats["offers_inserted"] += 1
                else:
                    stats["offers_updated"] += 1

                # --- Target ---
                target_url = _build_target_url(plain)
                is_new = _upsert_offer(db, plain, "Target", None, "USD", target_url, None)
                if is_new:
                    stats["offers_inserted"] += 1
                else:
                    stats["offers_updated"] += 1

                # --- Walmart ---
                walmart_url = _build_walmart_url(plain)
                is_new = _upsert_offer(db, plain, "Walmart", None, "USD", walmart_url, None)
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
