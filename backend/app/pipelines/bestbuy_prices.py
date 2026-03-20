"""
Pipeline: Fetch Best Buy prices by scraping search result pages.

Uses Best Buy's public search pages and extracts pricing data from
embedded JSON-LD structured data and __NEXT_DATA__.
No API key required.

If BESTBUY_API_KEY is configured, uses the official Products API instead
(faster and more reliable, but requires a business-domain email to register).

Processes active sets (current year +/- 1). Prioritises sets without recent
Best Buy offers, then oldest-checked first.
"""
from __future__ import annotations

import json
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote

import httpx
from sqlalchemy import select, and_, case, func
from sqlalchemy.orm import Session, aliased

from app.db import SessionLocal
from app.models import Offer as OfferModel, Set as SetModel
from app.pipelines._matching import match_lego_product

logger = logging.getLogger("bricktrack.pipeline.bestbuy_prices")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

BESTBUY_API_BASE = "https://api.bestbuy.com/v1/products"
REQUEST_TIMEOUT = 20.0
THROTTLE_SECONDS = 1.5  # Be polite — scraping public pages
MAX_SETS_PER_RUN = 200


def _get_api_key() -> Optional[str]:
    return os.getenv("BESTBUY_API_KEY", "").strip() or None


def _get_sets_to_process(db: Session) -> list[dict]:
    """Get active sets prioritised by never-checked then oldest-checked."""
    current_year = datetime.now().year
    bb_offer = aliased(OfferModel)

    rows = db.execute(
        select(SetModel.set_num, SetModel.name, SetModel.retail_price)
        .outerjoin(
            bb_offer,
            and_(
                func.replace(SetModel.set_num, "-1", "") == bb_offer.set_num,
                bb_offer.store == "Best Buy",
            ),
        )
        .where(
            SetModel.year >= current_year - 1,
            SetModel.year <= current_year + 1,
        )
        .order_by(
            case((bb_offer.last_checked.is_(None), 0), else_=1),
            bb_offer.last_checked.asc(),
            SetModel.year.desc(),
            SetModel.set_num.asc(),
        )
        .limit(MAX_SETS_PER_RUN)
    ).all()

    result = []
    for set_num, name, retail_price in rows:
        plain = set_num.split("-")[0] if set_num else set_num
        result.append({
            "set_num": set_num,
            "set_num_plain": plain,
            "name": name or "",
            "retail_price": retail_price,
        })
    return result


# ---------------------------------------------------------------------------
# Official API path (if key is available)
# ---------------------------------------------------------------------------

def _fetch_via_api(
    client: httpx.Client,
    api_key: str,
    set_num_plain: str,
    retail_price: Optional[float] = None,
) -> Optional[dict]:
    """Fetch price from Best Buy Products API (requires BESTBUY_API_KEY)."""
    search_filter = f"(search=lego&search={set_num_plain})"
    params = {
        "apiKey": api_key,
        "format": "json",
        "show": "sku,name,salePrice,regularPrice,url,onlineAvailability,inStoreAvailability",
        "pageSize": 10,
    }

    try:
        resp = client.get(
            f"{BESTBUY_API_BASE}{search_filter}",
            params=params,
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code in (403, 429):
            return None
        resp.raise_for_status()
    except httpx.HTTPError:
        return None

    data = resp.json()
    products = data.get("products", [])
    if not products:
        return None

    candidates = []
    for p in products:
        price = p.get("salePrice") or p.get("regularPrice")
        if price is None:
            continue
        candidates.append({
            "title": p.get("name", ""),
            "price": float(price),
            "url": p.get("url", ""),
            "in_stock": bool(p.get("onlineAvailability", False)),
        })

    match = match_lego_product(candidates, set_num_plain, retail_price)
    if not match:
        return None

    return {
        "price": match["price"],
        "url": match["url"],
        "in_stock": match["in_stock"],
    }


# ---------------------------------------------------------------------------
# HTML scraping path (no API key needed)
# ---------------------------------------------------------------------------

def _fetch_via_scrape(
    client: httpx.Client,
    set_num_plain: str,
    retail_price: Optional[float] = None,
) -> Optional[dict]:
    """Scrape Best Buy search results for LEGO set pricing."""
    search_url = f"https://www.bestbuy.com/site/searchpage.jsp?st=lego+{set_num_plain}"

    try:
        resp = client.get(
            search_url,
            headers=HEADERS,
            follow_redirects=True,
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code == 429:
            logger.warning("Best Buy rate limited, backing off 10s")
            time.sleep(10)
            return None
        if resp.status_code != 200:
            logger.debug("Best Buy search returned %d for set %s", resp.status_code, set_num_plain)
            return None
    except httpx.HTTPError:
        logger.debug("Best Buy request failed for set %s", set_num_plain)
        return None

    html = resp.text
    candidates = _parse_bestbuy_html(html, set_num_plain)

    if not candidates:
        return None

    match = match_lego_product(candidates, set_num_plain, retail_price)
    if not match:
        return None

    product_url = match.get("url", "")
    if product_url and not product_url.startswith("http"):
        product_url = f"https://www.bestbuy.com{product_url}"

    return {
        "price": match["price"],
        "url": product_url,
        "in_stock": match.get("in_stock"),
    }


def _parse_bestbuy_html(html: str, set_num_plain: str) -> list[dict]:
    """Extract product data from Best Buy search page HTML."""
    candidates = []

    # Try JSON-LD structured data first
    ld_matches = re.findall(
        r'<script\s+type="application/ld\+json">(.*?)</script>',
        html,
        re.DOTALL,
    )
    for ld_text in ld_matches:
        try:
            ld_data = json.loads(ld_text)
            items = ld_data if isinstance(ld_data, list) else [ld_data]
            for item in items:
                if item.get("@type") != "Product":
                    continue
                title = item.get("name", "")
                offers = item.get("offers", {})
                if isinstance(offers, list):
                    offers = offers[0] if offers else {}
                price = offers.get("price")
                if price is not None:
                    url = item.get("url", offers.get("url", ""))
                    avail = str(offers.get("availability", ""))
                    candidates.append({
                        "title": title,
                        "price": float(price),
                        "url": url,
                        "in_stock": "InStock" in avail,
                    })
        except (json.JSONDecodeError, ValueError, TypeError):
            continue

    # Try __NEXT_DATA__ as fallback
    if not candidates:
        next_data_match = re.search(
            r'<script\s+id="__NEXT_DATA__"\s+type="application/json">(.*?)</script>',
            html,
            re.DOTALL,
        )
        if next_data_match:
            try:
                data = json.loads(next_data_match.group(1))
                props = data.get("props", {}).get("pageProps", {})
                # Best Buy nests search results in various structures
                products = (
                    props.get("searchResults", {}).get("products", [])
                    or props.get("products", [])
                )
                for p in products:
                    title = p.get("name", p.get("displayName", ""))
                    price = (
                        p.get("salePrice")
                        or p.get("currentPrice")
                        or p.get("regularPrice")
                    )
                    if price is None:
                        price_str = p.get("priceString", "")
                        if price_str:
                            try:
                                price = float(price_str.replace("$", "").replace(",", ""))
                            except ValueError:
                                continue
                    if price is None:
                        continue

                    url = p.get("url", p.get("canonicalUrl", ""))
                    in_stock = p.get("onlineAvailability", p.get("isAvailableOnline"))

                    candidates.append({
                        "title": title,
                        "price": float(price),
                        "url": url,
                        "in_stock": bool(in_stock) if in_stock is not None else None,
                    })
            except (json.JSONDecodeError, KeyError, TypeError):
                logger.debug("Failed to parse Best Buy __NEXT_DATA__ for set %s", set_num_plain)

    # Fallback: regex price extraction from common HTML patterns
    if not candidates:
        # Look for product cards with data attributes
        card_pattern = re.findall(
            r'data-testid="product-card".*?aria-label="([^"]*)".*?'
            r'(?:\$|&#36;)([\d,]+\.?\d*)',
            html,
            re.DOTALL,
        )
        for title, price_str in card_pattern:
            try:
                price = float(price_str.replace(",", ""))
                candidates.append({
                    "title": title,
                    "price": price,
                    "url": "",
                    "in_stock": None,
                })
            except ValueError:
                continue

    return candidates


# ---------------------------------------------------------------------------
# Offer upsert
# ---------------------------------------------------------------------------

def _upsert_offer(
    db: Session,
    set_num_plain: str,
    store: str,
    price: Optional[float],
    currency: str,
    url: str,
    in_stock: Optional[bool],
) -> bool:
    """Insert or update an offer row. Returns True if new."""
    now = datetime.now(timezone.utc)

    existing = db.execute(
        select(OfferModel).where(
            and_(OfferModel.set_num == set_num_plain, OfferModel.store == store)
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


# ---------------------------------------------------------------------------
# Main pipeline
# ---------------------------------------------------------------------------

def run_bestbuy_prices() -> dict:
    """
    Fetch Best Buy prices for active LEGO sets.

    Uses the official API if BESTBUY_API_KEY is set, otherwise scrapes
    search pages (no key needed).

    Called by:
    - APScheduler (daily at 6 AM UTC)
    - POST /admin/pipelines/bestbuy_prices/run
    """
    api_key = _get_api_key()
    mode = "api" if api_key else "scrape"
    logger.info("Starting Best Buy price fetch (mode=%s)...", mode)
    t0 = time.time()

    db: Session = SessionLocal()
    stats = {
        "mode": mode,
        "sets_processed": 0,
        "prices_found": 0,
        "offers_inserted": 0,
        "offers_updated": 0,
        "skipped_no_data": 0,
        "api_errors": 0,
    }

    try:
        sets_to_process = _get_sets_to_process(db)
        logger.info("Will process %d sets for Best Buy prices", len(sets_to_process))

        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            for s in sets_to_process:
                plain = s["set_num_plain"]
                stats["sets_processed"] += 1

                try:
                    if api_key:
                        result = _fetch_via_api(client, api_key, plain, s.get("retail_price"))
                    else:
                        result = _fetch_via_scrape(client, plain, s.get("retail_price"))
                except Exception:
                    logger.debug("Unexpected error for Best Buy set %s", plain, exc_info=True)
                    stats["api_errors"] += 1
                    continue

                if result and result.get("price"):
                    stats["prices_found"] += 1
                    is_new = _upsert_offer(
                        db, plain, "Best Buy",
                        result["price"], "USD",
                        result["url"], result.get("in_stock"),
                    )
                    if is_new:
                        stats["offers_inserted"] += 1
                    else:
                        stats["offers_updated"] += 1
                else:
                    stats["skipped_no_data"] += 1

                db.commit()

                # Throttle: slower for scraping, faster for API
                throttle = 0.25 if api_key else THROTTLE_SECONDS
                time.sleep(throttle)

                if stats["sets_processed"] % 50 == 0:
                    logger.info(
                        "Best Buy progress: %d/%d processed, %d prices found",
                        stats["sets_processed"], len(sets_to_process), stats["prices_found"],
                    )

        stats["elapsed_seconds"] = round(time.time() - t0, 1)
        stats["completed_at"] = datetime.now(timezone.utc).isoformat()
        logger.info("Best Buy price fetch complete: %s", stats)
        return stats

    except Exception:
        db.rollback()
        logger.exception("Best Buy price fetch failed")
        return {
            "error": "bestbuy_fetch_failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            **stats,
        }
    finally:
        db.close()
