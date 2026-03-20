"""
Pipeline: Fetch Walmart prices via their search API.

Uses Walmart's public search endpoint (same one target.com's frontend calls).
No API key required. Wraps product URLs with Impact.com affiliate redirect
when WALMART_IMPACT_AFFILIATE_ID is configured.

Processes active sets (current year +/- 1).
"""
from __future__ import annotations

import logging
import os
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

logger = logging.getLogger("bricktrack.pipeline.walmart_prices")

WALMART_SEARCH_URL = "https://www.walmart.com/orchestra/snb/graphql/Search"
WALMART_IMPACT_ID = os.getenv("WALMART_IMPACT_AFFILIATE_ID", "")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Content-Type": "application/json",
    "X-O-PLATFORM": "rweb",
    "X-O-CORRELATION-ID": "render",
}

REQUEST_TIMEOUT = 20.0
THROTTLE_SECONDS = 1.5  # Be polite — unofficial API
MAX_SETS_PER_RUN = 200


def _get_sets_to_process(db: Session) -> list[dict]:
    """Get active sets prioritised by never-checked then oldest-checked."""
    current_year = datetime.now().year
    wm_offer = aliased(OfferModel)

    rows = db.execute(
        select(SetModel.set_num, SetModel.name, SetModel.retail_price)
        .outerjoin(
            wm_offer,
            and_(
                func.replace(SetModel.set_num, "-1", "") == wm_offer.set_num,
                wm_offer.store == "Walmart",
            ),
        )
        .where(
            SetModel.year >= current_year - 1,
            SetModel.year <= current_year + 1,
        )
        .order_by(
            case((wm_offer.last_checked.is_(None), 0), else_=1),
            wm_offer.last_checked.asc(),
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


def _build_affiliate_url(product_url: str) -> str:
    """Wrap a Walmart product URL with Impact affiliate redirect."""
    affiliate_id = WALMART_IMPACT_ID or os.getenv("WALMART_IMPACT_AFFILIATE_ID", "")
    if affiliate_id:
        return f"https://goto.walmart.com/c/{quote(affiliate_id)}/1/2?u={quote(product_url)}"
    return product_url


def _fetch_walmart_price(
    client: httpx.Client,
    set_num_plain: str,
    retail_price: Optional[float] = None,
) -> Optional[dict]:
    """
    Search Walmart for a LEGO set and return price data.

    Returns {"price": float, "url": str, "in_stock": bool} or None.
    """
    query = f"lego {set_num_plain}"

    # Walmart uses a GraphQL-style search endpoint
    payload = {
        "query": query,
        "sort": "best_match",
        "page": 1,
        "ps": 10,
        "affinityOverride": "default",
    }

    try:
        # Try the simple search API first
        search_url = f"https://www.walmart.com/search?q={quote(query)}"
        resp = client.get(
            search_url,
            headers={
                **HEADERS,
                "Accept": "text/html,application/xhtml+xml",
            },
            follow_redirects=True,
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code == 429:
            logger.warning("Walmart rate limited, backing off 10s")
            time.sleep(10)
            return None
        if resp.status_code != 200:
            logger.debug("Walmart search returned %d for set %s", resp.status_code, set_num_plain)
            return None
    except httpx.HTTPError:
        logger.debug("Walmart request failed for set %s", set_num_plain)
        return None

    # Parse the __NEXT_DATA__ JSON embedded in the HTML
    html = resp.text
    candidates = _parse_walmart_html(html, set_num_plain)

    if not candidates:
        return None

    match = match_lego_product(candidates, set_num_plain, retail_price)
    if not match:
        return None

    product_url = match.get("url", "")
    if product_url and not product_url.startswith("http"):
        product_url = f"https://www.walmart.com{product_url}"

    return {
        "price": match["price"],
        "url": _build_affiliate_url(product_url),
        "in_stock": match.get("in_stock"),
    }


def _parse_walmart_html(html: str, set_num_plain: str) -> list[dict]:
    """Extract product data from Walmart search page HTML (__NEXT_DATA__ or JSON-LD)."""
    import json
    import re

    candidates = []

    # Try to extract __NEXT_DATA__ JSON
    next_data_match = re.search(
        r'<script\s+id="__NEXT_DATA__"\s+type="application/json">(.*?)</script>',
        html,
        re.DOTALL,
    )

    if next_data_match:
        try:
            data = json.loads(next_data_match.group(1))
            # Navigate the nested structure to find search results
            props = data.get("props", {}).get("pageProps", {})
            initial_data = props.get("initialData", {})
            search_result = initial_data.get("searchResult", {})
            items = search_result.get("itemStacks", [])

            for stack in items:
                for item in stack.get("items", []):
                    if item.get("__typename") not in ("Product", "SearchProduct"):
                        continue

                    title = item.get("name", "")
                    price_info = item.get("priceInfo", {})
                    current_price = price_info.get("currentPrice", {})
                    price = current_price.get("price")
                    if price is None:
                        price_str = current_price.get("priceString", "")
                        if price_str:
                            try:
                                price = float(price_str.replace("$", "").replace(",", ""))
                            except ValueError:
                                continue

                    if price is None:
                        continue

                    canonical_url = item.get("canonicalUrl", "")
                    avail = item.get("availabilityStatusV2", {})
                    in_stock = avail.get("value", "") == "IN_STOCK" if avail else None

                    candidates.append({
                        "title": title,
                        "price": float(price),
                        "url": canonical_url,
                        "in_stock": in_stock,
                    })
        except (json.JSONDecodeError, KeyError, TypeError):
            logger.debug("Failed to parse Walmart __NEXT_DATA__ for set %s", set_num_plain)

    # Fallback: try JSON-LD structured data
    if not candidates:
        ld_pattern = re.findall(
            r'<script\s+type="application/ld\+json">(.*?)</script>',
            html,
            re.DOTALL,
        )
        for ld_text in ld_pattern:
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
                        candidates.append({
                            "title": title,
                            "price": float(price),
                            "url": offers.get("url", ""),
                            "in_stock": "InStock" in str(offers.get("availability", "")),
                        })
            except (json.JSONDecodeError, ValueError, TypeError):
                continue

    return candidates


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


def run_walmart_prices() -> dict:
    """
    Fetch Walmart prices for active LEGO sets.

    Called by:
    - APScheduler (daily at 6:30 AM UTC)
    - POST /admin/pipelines/walmart_prices/run
    """
    logger.info("Starting Walmart price fetch...")
    t0 = time.time()

    db: Session = SessionLocal()
    stats = {
        "sets_processed": 0,
        "prices_found": 0,
        "offers_inserted": 0,
        "offers_updated": 0,
        "skipped_no_data": 0,
        "api_errors": 0,
    }

    try:
        sets_to_process = _get_sets_to_process(db)
        logger.info("Will process %d sets for Walmart prices", len(sets_to_process))

        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            for s in sets_to_process:
                plain = s["set_num_plain"]
                stats["sets_processed"] += 1

                try:
                    result = _fetch_walmart_price(
                        client, plain, s.get("retail_price")
                    )
                except Exception:
                    logger.debug("Unexpected error for Walmart set %s", plain, exc_info=True)
                    stats["api_errors"] += 1
                    continue

                if result and result.get("price"):
                    stats["prices_found"] += 1
                    is_new = _upsert_offer(
                        db, plain, "Walmart",
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
                time.sleep(THROTTLE_SECONDS)

                if stats["sets_processed"] % 50 == 0:
                    logger.info(
                        "Walmart progress: %d/%d processed, %d prices found",
                        stats["sets_processed"], len(sets_to_process), stats["prices_found"],
                    )

        stats["elapsed_seconds"] = round(time.time() - t0, 1)
        stats["completed_at"] = datetime.now(timezone.utc).isoformat()
        logger.info("Walmart price fetch complete: %s", stats)
        return stats

    except Exception:
        db.rollback()
        logger.exception("Walmart price fetch failed")
        return {
            "error": "walmart_fetch_failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            **stats,
        }
    finally:
        db.close()
