"""
Pipeline: Scrape live prices from third-party retailers (Target, Best Buy, Walmart).

Uses JSON-LD structured data from product pages when available.
Falls back gracefully — never deletes existing price data on failure.

Amazon is excluded from price scraping (requires PA-API); only ASIN
discovery is attempted so we can build direct product links.

Scheduled separately from the LEGO.com price scraper to isolate failure
modes and respect per-retailer rate limits.
"""
from __future__ import annotations

import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote, urlencode

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Offer as OfferModel, Set as SetModel
from app.pipelines._scraper_utils import (
    extract_jsonld_product_offer,
    SCRAPER_HEADERS,
)

logger = logging.getLogger("bricktrack.pipeline.retailer_scraper")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

AMAZON_TAG = os.getenv("AMAZON_AFFILIATE_TAG", "bricktrack-20")
WALMART_IMPACT_ID = os.getenv("WALMART_IMPACT_AFFILIATE_ID", "")
TARGET_IMPACT_ID = os.getenv("TARGET_IMPACT_AFFILIATE_ID", "")

REQUEST_TIMEOUT = 20.0
MAX_SETS_PER_RUN = 150

# Per-retailer throttle (seconds between requests to the same domain)
THROTTLE = {
    "Target": 3.0,
    "Best Buy": 3.0,
    "Walmart": 4.0,
}

# How many consecutive blocks before we skip a retailer entirely
MAX_CONSECUTIVE_BLOCKS = 3


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_active_sets(db: Session) -> list[dict]:
    """Return active sets (current year ± 1) with UPC data for product lookups.

    Prioritises sets that have never been checked by the retailer scraper
    (no Target offer) or were checked longest ago.
    """
    from sqlalchemy import func, case
    from sqlalchemy.orm import aliased

    current_year = datetime.now().year
    target_offer = aliased(OfferModel)

    rows = db.execute(
        select(
            SetModel.set_num,
            SetModel.name,
            SetModel.year,
            SetModel.barcode_upc,
        )
        .outerjoin(
            target_offer,
            and_(
                func.replace(SetModel.set_num, "-1", "") == target_offer.set_num,
                target_offer.store == "Target",
            ),
        )
        .where(
            SetModel.year >= current_year - 1,
            SetModel.year <= current_year + 1,
        )
        .order_by(
            case((target_offer.last_checked.is_(None), 0), else_=1),
            target_offer.last_checked.asc(),
            SetModel.year.desc(),
            SetModel.set_num.asc(),
        )
        .limit(MAX_SETS_PER_RUN)
    ).all()

    result = []
    for set_num, name, year, upc in rows:
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


def _is_blocked(resp: httpx.Response) -> bool:
    """Heuristic: detect anti-bot / captcha responses."""
    if resp.status_code in (403, 429):
        return True
    body = resp.text[:2000].lower()
    if "captcha" in body or "robot" in body or "blocked" in body:
        return True
    return False


# ---------------------------------------------------------------------------
# Target
# ---------------------------------------------------------------------------

def _scrape_target(
    client: httpx.Client,
    set_num_plain: str,
    upc: Optional[str],
) -> Optional[dict]:
    """Attempt to find and scrape a Target product page for a LEGO set.

    Strategy:
      1. Search by UPC (most precise) if available
      2. Fall back to set number search
      3. Find product link in search results
      4. Scrape product page for JSON-LD price data

    Returns {"price", "currency", "in_stock", "url"} or None.
    """
    # Try UPC search first for exact match, then set number
    search_terms = []
    if upc:
        search_terms.append(upc)
    search_terms.append(f"lego {set_num_plain}")

    product_url = None

    for term in search_terms:
        search_url = f"https://www.target.com/s?searchTerm={quote(term)}"
        try:
            resp = client.get(search_url, headers=SCRAPER_HEADERS, follow_redirects=True)
            if _is_blocked(resp):
                logger.warning("Target blocked search for %s", set_num_plain)
                return {"blocked": True}
            if resp.status_code != 200:
                continue
        except httpx.HTTPError:
            logger.debug("Target search failed for %s", set_num_plain)
            continue

        # Look for product links in the HTML
        soup = BeautifulSoup(resp.text, "html.parser")

        # Target product links match /p/{slug}/-/A-{dpci}
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            if re.search(r"/p/[^/]+-/A-\d+", href):
                if "lego" in href.lower() or "lego" in (a_tag.get_text() or "").lower():
                    product_url = href if href.startswith("http") else f"https://www.target.com{href}"
                    break

        if product_url:
            break

    if not product_url:
        return None

    # Scrape the product page for JSON-LD
    time.sleep(1)  # Brief pause between search and product page
    try:
        resp = client.get(product_url, headers=SCRAPER_HEADERS, follow_redirects=True)
        if _is_blocked(resp):
            logger.warning("Target blocked product page for %s", set_num_plain)
            return {"blocked": True}
        if resp.status_code != 200:
            return None
    except httpx.HTTPError:
        logger.debug("Target product page failed for %s", set_num_plain)
        return None

    result = extract_jsonld_product_offer(resp.text)
    if result:
        # Build the affiliate URL for the discovered product page
        if TARGET_IMPACT_ID:
            result["url"] = f"https://goto.target.com/c/{quote(TARGET_IMPACT_ID)}/1/2?u={quote(product_url)}"
        else:
            result["url"] = product_url
        return result

    return None


# ---------------------------------------------------------------------------
# Best Buy
# ---------------------------------------------------------------------------

def _scrape_bestbuy(
    client: httpx.Client,
    set_num_plain: str,
    upc: Optional[str],
) -> Optional[dict]:
    """Scrape Best Buy for LEGO set price via JSON-LD.

    Strategy:
      1. Search Best Buy by set number (or UPC)
      2. Find product link in search results
      3. Scrape product page for JSON-LD
    """
    search_terms = []
    if upc:
        search_terms.append(upc)
    search_terms.append(f"lego {set_num_plain}")

    product_url = None

    for term in search_terms:
        search_url = f"https://www.bestbuy.com/site/searchpage.jsp?st={quote(term)}"
        try:
            resp = client.get(search_url, headers=SCRAPER_HEADERS, follow_redirects=True)
            if _is_blocked(resp):
                logger.warning("Best Buy blocked search for %s", set_num_plain)
                return {"blocked": True}
            if resp.status_code != 200:
                continue
        except httpx.HTTPError:
            logger.debug("Best Buy search failed for %s", set_num_plain)
            continue

        soup = BeautifulSoup(resp.text, "html.parser")

        # Best Buy product links: /site/{slug}/{sku}.p
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            if re.search(r"/site/.+/\d+\.p", href):
                text = (a_tag.get_text() or "").lower()
                if "lego" in href.lower() or "lego" in text:
                    product_url = href if href.startswith("http") else f"https://www.bestbuy.com{href}"
                    break

        if product_url:
            break

    if not product_url:
        return None

    time.sleep(1)
    try:
        resp = client.get(product_url, headers=SCRAPER_HEADERS, follow_redirects=True)
        if _is_blocked(resp):
            logger.warning("Best Buy blocked product page for %s", set_num_plain)
            return {"blocked": True}
        if resp.status_code != 200:
            return None
    except httpx.HTTPError:
        logger.debug("Best Buy product page failed for %s", set_num_plain)
        return None

    result = extract_jsonld_product_offer(resp.text)
    if result:
        result["url"] = product_url
        return result

    return None


# ---------------------------------------------------------------------------
# Walmart
# ---------------------------------------------------------------------------

def _scrape_walmart(
    client: httpx.Client,
    set_num_plain: str,
    upc: Optional[str],
) -> Optional[dict]:
    """Scrape Walmart for LEGO set price via JSON-LD.

    Walmart is more JS-heavy than Target/Best Buy. We attempt to parse
    server-rendered HTML but may not always find JSON-LD on search pages.
    """
    search_terms = []
    if upc:
        search_terms.append(upc)
    search_terms.append(f"lego {set_num_plain}")

    product_url = None

    for term in search_terms:
        search_url = f"https://www.walmart.com/search?q={quote(term)}"
        try:
            resp = client.get(search_url, headers=SCRAPER_HEADERS, follow_redirects=True)
            if _is_blocked(resp):
                logger.warning("Walmart blocked search for %s", set_num_plain)
                return {"blocked": True}
            if resp.status_code != 200:
                continue
        except httpx.HTTPError:
            logger.debug("Walmart search failed for %s", set_num_plain)
            continue

        soup = BeautifulSoup(resp.text, "html.parser")

        # Walmart product links: /ip/{slug}/{item_id}
        for a_tag in soup.find_all("a", href=True):
            href = a_tag["href"]
            if re.search(r"/ip/[^/]+/\d+", href):
                text = (a_tag.get_text() or "").lower()
                if "lego" in href.lower() or "lego" in text:
                    product_url = href if href.startswith("http") else f"https://www.walmart.com{href}"
                    break

        if product_url:
            break

    if not product_url:
        return None

    time.sleep(1)
    try:
        resp = client.get(product_url, headers=SCRAPER_HEADERS, follow_redirects=True)
        if _is_blocked(resp):
            logger.warning("Walmart blocked product page for %s", set_num_plain)
            return {"blocked": True}
        if resp.status_code != 200:
            return None
    except httpx.HTTPError:
        logger.debug("Walmart product page failed for %s", set_num_plain)
        return None

    result = extract_jsonld_product_offer(resp.text)
    if result:
        # Wrap in Impact affiliate URL if configured
        if WALMART_IMPACT_ID:
            result["url"] = f"https://goto.walmart.com/c/{quote(WALMART_IMPACT_ID)}/1/2?u={quote(product_url)}"
        else:
            result["url"] = product_url
        return result

    return None


# ---------------------------------------------------------------------------
# Amazon ASIN Discovery (no price scraping)
# ---------------------------------------------------------------------------

def _discover_asin(
    client: httpx.Client,
    set_num_plain: str,
    upc: Optional[str],
) -> Optional[str]:
    """Attempt to discover an Amazon ASIN for a LEGO set via UPC lookup.

    Uses the free UPCitemdb.com API (100 lookups/day) to convert UPC → ASIN.
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
                # Extract ASIN from Amazon URL (e.g., /dp/B0XXXXX)
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

# Retailer scraper functions, processed in order of reliability
_RETAILER_SCRAPERS = [
    ("Target", _scrape_target),
    ("Best Buy", _scrape_bestbuy),
    ("Walmart", _scrape_walmart),
]


def run_retailer_scrape() -> dict:
    """
    Main pipeline: scrape live prices from Target, Best Buy, and Walmart.

    Also attempts Amazon ASIN discovery for sets with UPC barcodes.

    Called by:
    - APScheduler (every 8 hours)
    - POST /admin/pipelines/retailer_scrape/run
    """
    logger.info("Starting retailer price scrape...")
    t0 = time.time()

    db = SessionLocal()
    stats = {
        "sets_processed": 0,
        "prices_found": {},
        "offers_inserted": 0,
        "offers_updated": 0,
        "blocked_retailers": [],
        "asins_discovered": 0,
    }

    try:
        active_sets = _get_active_sets(db)
        logger.info("Will process %d active sets across retailers", len(active_sets))

        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            # --- Retailer price scraping (one retailer at a time) ---
            for store_name, scraper_fn in _RETAILER_SCRAPERS:
                consecutive_blocks = 0
                stats["prices_found"][store_name] = 0

                logger.info("Scraping %s prices...", store_name)

                for s in active_sets:
                    plain = s["set_num_plain"]
                    upc = s.get("upc")

                    result = scraper_fn(client, plain, upc)

                    if result and result.get("blocked"):
                        consecutive_blocks += 1
                        if consecutive_blocks >= MAX_CONSECUTIVE_BLOCKS:
                            logger.warning(
                                "Skipping %s — %d consecutive blocks",
                                store_name,
                                consecutive_blocks,
                            )
                            stats["blocked_retailers"].append(store_name)
                            break
                        time.sleep(THROTTLE[store_name] * 2)  # Extra pause after block
                        continue

                    consecutive_blocks = 0  # Reset on success or non-block failure

                    if result and result.get("price") is not None:
                        stats["prices_found"][store_name] += 1
                        action = _upsert_offer(
                            db, plain, store_name,
                            result["price"],
                            result.get("currency", "USD"),
                            result["url"],
                            result.get("in_stock"),
                        )
                    elif result and result.get("url"):
                        # Found product page but no price — update URL only
                        action = _upsert_offer(
                            db, plain, store_name,
                            None,
                            "USD",
                            result["url"],
                            result.get("in_stock"),
                        )
                    else:
                        action = None

                    if action == "inserted":
                        stats["offers_inserted"] += 1
                    elif action == "updated":
                        stats["offers_updated"] += 1

                    stats["sets_processed"] += 1
                    db.commit()

                    time.sleep(THROTTLE[store_name])

            # --- Amazon ASIN discovery ---
            logger.info("Running Amazon ASIN discovery...")
            asin_count = 0
            for s in active_sets:
                plain = s["set_num_plain"]
                upc = s.get("upc")
                if not upc:
                    continue

                # Check if we already have an ASIN
                existing = db.execute(
                    select(OfferModel).where(
                        and_(
                            OfferModel.set_num == plain,
                            OfferModel.store == "Amazon",
                        )
                    )
                ).scalar_one_or_none()

                if existing and existing.asin:
                    continue  # Already have ASIN

                asin = _discover_asin(client, plain, upc)
                if asin:
                    # Build direct product URL with affiliate tag
                    direct_url = f"https://www.amazon.com/dp/{quote(asin)}?tag={quote(AMAZON_TAG)}"
                    _upsert_offer(
                        db, plain, "Amazon",
                        None,  # No price without PA-API
                        "USD",
                        direct_url,
                        None,
                        asin=asin,
                    )
                    db.commit()
                    asin_count += 1
                    stats["asins_discovered"] += 1

                    # Rate limit UPC API (free tier)
                    time.sleep(1.0)

                    # Cap at 90 lookups per run (stay under 100/day free tier)
                    if asin_count >= 90:
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
