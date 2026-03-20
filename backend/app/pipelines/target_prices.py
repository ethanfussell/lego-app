"""
Pipeline: Fetch Target prices via the Redsky API.

Redsky is Target's internal product/pricing API used by target.com.
It is publicly accessible with a public API key embedded in their frontend JS.
No registration required.

Wraps product URLs with Impact.com affiliate redirect when
TARGET_IMPACT_AFFILIATE_ID is configured.

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

logger = logging.getLogger("bricktrack.pipeline.target_prices")

# Public API key from Target's frontend JS — not a secret
REDSKY_KEY = os.getenv("TARGET_REDSKY_KEY", "9f36aeafbe60771e321a5cc")
REDSKY_SEARCH_URL = "https://redsky.target.com/redsky_aggregations/v1/web/plp_search_v2"
TARGET_IMPACT_ID = os.getenv("TARGET_IMPACT_AFFILIATE_ID", "")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.target.com",
    "Referer": "https://www.target.com/",
}

REQUEST_TIMEOUT = 20.0
THROTTLE_SECONDS = 1.5  # Be polite — unofficial API
MAX_SETS_PER_RUN = 200


def _get_sets_to_process(db: Session) -> list[dict]:
    """Get active sets prioritised by never-checked then oldest-checked."""
    current_year = datetime.now().year
    tgt_offer = aliased(OfferModel)

    rows = db.execute(
        select(SetModel.set_num, SetModel.name, SetModel.retail_price)
        .outerjoin(
            tgt_offer,
            and_(
                func.replace(SetModel.set_num, "-1", "") == tgt_offer.set_num,
                tgt_offer.store == "Target",
            ),
        )
        .where(
            SetModel.year >= current_year - 1,
            SetModel.year <= current_year + 1,
        )
        .order_by(
            case((tgt_offer.last_checked.is_(None), 0), else_=1),
            tgt_offer.last_checked.asc(),
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
    """Wrap a Target product URL with Impact affiliate redirect."""
    affiliate_id = TARGET_IMPACT_ID or os.getenv("TARGET_IMPACT_AFFILIATE_ID", "")
    if affiliate_id:
        return f"https://goto.target.com/c/{quote(affiliate_id)}/1/2?u={quote(product_url)}"
    return product_url


def _fetch_target_price(
    client: httpx.Client,
    set_num_plain: str,
    retail_price: Optional[float] = None,
) -> Optional[dict]:
    """
    Search Target via Redsky API for a LEGO set and return price data.

    Returns {"price": float, "url": str, "in_stock": bool} or None.
    """
    keyword = f"lego {set_num_plain}"

    params = {
        "key": REDSKY_KEY,
        "channel": "WEB",
        "count": 24,
        "keyword": keyword,
        "page": f"/s/{keyword}",
        "pricing_store_id": "3991",
        "visitor_id": "visitor",
        "has_pricing_store_id": "true",
    }

    try:
        resp = client.get(
            REDSKY_SEARCH_URL,
            params=params,
            headers=HEADERS,
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code == 403:
            logger.warning("Target Redsky API returned 403 — key may have rotated")
            return None
        if resp.status_code == 429:
            logger.warning("Target rate limited, backing off 10s")
            time.sleep(10)
            return None
        if resp.status_code != 200:
            logger.debug("Target search returned %d for set %s", resp.status_code, set_num_plain)
            return None
    except httpx.HTTPError:
        logger.debug("Target request failed for set %s", set_num_plain)
        return None

    try:
        data = resp.json()
    except Exception:
        logger.debug("Target returned non-JSON for set %s", set_num_plain)
        return None

    # Navigate the Redsky response structure
    search_data = data.get("data", {}).get("search", {})
    products = search_data.get("products", [])

    if not products:
        return None

    candidates = []
    for p in products:
        item = p.get("item", {})
        title = item.get("product_description", {}).get("title", "")

        # Price data
        price_data = p.get("price", {})
        price = price_data.get("current_retail")
        if price is None:
            price = price_data.get("reg_retail")
        if price is None:
            formatted = price_data.get("formatted_current_price", "")
            if formatted:
                try:
                    price = float(formatted.replace("$", "").replace(",", ""))
                except ValueError:
                    continue

        if price is None:
            continue

        # Product URL
        enrichment = item.get("enrichment", {})
        buy_url = enrichment.get("buy_url", "")
        tcin = p.get("tcin", "")

        # Build canonical URL
        if buy_url:
            product_url = buy_url
        elif tcin:
            product_url = f"https://www.target.com/p/-/A-{tcin}"
        else:
            continue

        # Availability
        avail_status = p.get("availability", {}).get("availability_status", "")
        in_stock = avail_status == "IN_STOCK" if avail_status else None

        candidates.append({
            "title": title,
            "price": float(price),
            "url": product_url,
            "in_stock": in_stock,
            "tcin": tcin,
        })

    match = match_lego_product(candidates, set_num_plain, retail_price)
    if not match:
        return None

    return {
        "price": match["price"],
        "url": _build_affiliate_url(match["url"]),
        "in_stock": match.get("in_stock"),
    }


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


def run_target_prices() -> dict:
    """
    Fetch Target prices for active LEGO sets.

    Called by:
    - APScheduler (daily at 7 AM UTC)
    - POST /admin/pipelines/target_prices/run
    """
    logger.info("Starting Target price fetch...")
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
        logger.info("Will process %d sets for Target prices", len(sets_to_process))

        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            for s in sets_to_process:
                plain = s["set_num_plain"]
                stats["sets_processed"] += 1

                try:
                    result = _fetch_target_price(
                        client, plain, s.get("retail_price")
                    )
                except Exception:
                    logger.debug("Unexpected error for Target set %s", plain, exc_info=True)
                    stats["api_errors"] += 1
                    continue

                if result and result.get("price"):
                    stats["prices_found"] += 1
                    is_new = _upsert_offer(
                        db, plain, "Target",
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
                        "Target progress: %d/%d processed, %d prices found",
                        stats["sets_processed"], len(sets_to_process), stats["prices_found"],
                    )

        stats["elapsed_seconds"] = round(time.time() - t0, 1)
        stats["completed_at"] = datetime.now(timezone.utc).isoformat()
        logger.info("Target price fetch complete: %s", stats)
        return stats

    except Exception:
        db.rollback()
        logger.exception("Target price fetch failed")
        return {
            "error": "target_fetch_failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            **stats,
        }
    finally:
        db.close()
