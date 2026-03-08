"""
Pipeline: Fetch BrickLink aftermarket prices via the BrickLink API v3.

API docs: https://www.bricklink.com/v3/api.page
Auth: OAuth 1.0 (consumer key/secret + token key/secret)
Rate limit: 5,000 requests/day

Processes ALL sets — the primary value is aftermarket pricing for retired sets.
Uses the Price Guide endpoint for "sold" items in "New" condition.
Stores the average sold price (last 6 months), the standard LEGO community reference.
"""
from __future__ import annotations

import hashlib
import hmac
import logging
import os
import time
import uuid
from base64 import b64encode
from datetime import datetime, timezone
from typing import Optional
from urllib.parse import quote as urlquote

import httpx
from sqlalchemy import select, and_, func, case
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Offer as OfferModel, Set as SetModel

logger = logging.getLogger("bricktrack.pipeline.bricklink_prices")

BRICKLINK_API_BASE = "https://api.bricklink.com/api/store/v1"
REQUEST_TIMEOUT = 15.0
THROTTLE_SECONDS = 1.0  # ~1 req/sec, well under 5000/day limit
MAX_SETS_PER_RUN = 500


# ---------------------------------------------------------------------------
# OAuth 1.0 HMAC-SHA1 (hand-rolled, no external dependency)
# ---------------------------------------------------------------------------

def _get_credentials() -> dict:
    """Load BrickLink OAuth 1.0 credentials from environment."""
    creds = {
        "consumer_key": os.getenv("BRICKLINK_CONSUMER_KEY", ""),
        "consumer_secret": os.getenv("BRICKLINK_CONSUMER_SECRET", ""),
        "token": os.getenv("BRICKLINK_TOKEN_KEY", ""),
        "token_secret": os.getenv("BRICKLINK_TOKEN_SECRET", ""),
    }
    missing = [k for k, v in creds.items() if not v]
    if missing:
        raise RuntimeError(f"Missing BrickLink credentials: {', '.join(missing)}")
    return creds


def _oauth1_header(
    method: str, url: str, creds: dict, params: dict | None = None
) -> str:
    """Build an OAuth 1.0 Authorization header (HMAC-SHA1)."""
    oauth_params = {
        "oauth_consumer_key": creds["consumer_key"],
        "oauth_token": creds["token"],
        "oauth_signature_method": "HMAC-SHA1",
        "oauth_timestamp": str(int(time.time())),
        "oauth_nonce": uuid.uuid4().hex,
        "oauth_version": "1.0",
    }

    # Combine OAuth params + query params for signature base string
    all_params = {**oauth_params}
    if params:
        all_params.update(params)

    sorted_params = sorted(all_params.items())
    param_string = "&".join(
        f"{urlquote(str(k), safe='')}"
        f"={urlquote(str(v), safe='')}"
        for k, v in sorted_params
    )

    base_string = (
        f"{method.upper()}&"
        f"{urlquote(url, safe='')}&"
        f"{urlquote(param_string, safe='')}"
    )

    signing_key = (
        f"{urlquote(creds['consumer_secret'], safe='')}&"
        f"{urlquote(creds['token_secret'], safe='')}"
    )

    signature = b64encode(
        hmac.new(
            signing_key.encode("utf-8"),
            base_string.encode("utf-8"),
            hashlib.sha1,
        ).digest()
    ).decode("utf-8")

    oauth_params["oauth_signature"] = signature

    header_parts = ", ".join(
        f'{urlquote(k, safe="")}="{urlquote(v, safe="")}"'
        for k, v in sorted(oauth_params.items())
    )
    return f"OAuth {header_parts}"


# ---------------------------------------------------------------------------
# Set selection
# ---------------------------------------------------------------------------

def _get_sets_to_process(db: Session) -> list[dict]:
    """
    Get sets to process, prioritizing those without a recent BrickLink offer.

    Uses a LEFT JOIN on the offers table so sets never fetched come first,
    then sets with the oldest last_checked timestamp.
    """
    # Subquery: latest BrickLink offer check per set_num
    bl_offer = (
        select(
            OfferModel.set_num,
            func.max(OfferModel.last_checked).label("last_bl_check"),
        )
        .where(OfferModel.store == "BrickLink")
        .group_by(OfferModel.set_num)
        .subquery()
    )

    rows = db.execute(
        select(
            SetModel.set_num,
            SetModel.name,
            SetModel.retirement_status,
        )
        .outerjoin(
            bl_offer,
            func.split_part(SetModel.set_num, "-", 1) == bl_offer.c.set_num,
        )
        .order_by(
            bl_offer.c.last_bl_check.asc().nulls_first(),
            SetModel.set_num.asc(),
        )
        .limit(MAX_SETS_PER_RUN)
    ).all()

    result = []
    for set_num, name, status in rows:
        plain = set_num.split("-")[0] if set_num else set_num
        result.append({
            "set_num": set_num,
            "set_num_plain": plain,
            "name": name or "",
            "retirement_status": status,
        })
    return result


# ---------------------------------------------------------------------------
# BrickLink API
# ---------------------------------------------------------------------------

def _fetch_price_guide(
    client: httpx.Client,
    creds: dict,
    set_num_plain: str,
) -> Optional[dict]:
    """
    Fetch the BrickLink Price Guide for a set.

    Returns {"avg_price": float, "min_price": float, "max_price": float,
             "qty_sold": int} or None.
    """
    item_no = f"{set_num_plain}-1"
    url = f"{BRICKLINK_API_BASE}/items/SET/{item_no}/price"

    params = {
        "guide_type": "sold",
        "new_or_used": "N",
        "country_code": "US",
        "currency_code": "USD",
    }

    auth_header = _oauth1_header("GET", url, creds, params)

    try:
        resp = client.get(
            url,
            params=params,
            headers={"Authorization": auth_header},
            timeout=REQUEST_TIMEOUT,
        )
        if resp.status_code == 404:
            return None
        if resp.status_code == 429:
            logger.warning("BrickLink rate limited, backing off 10s")
            time.sleep(10)
            return None
        resp.raise_for_status()
    except httpx.HTTPError:
        logger.debug("BrickLink request failed for set %s", set_num_plain)
        return None

    data = resp.json()

    meta = data.get("meta", {})
    if meta.get("code") != 200:
        logger.debug("BrickLink non-200 meta for %s: %s", set_num_plain, meta)
        return None

    price_data = data.get("data", {})

    try:
        avg_price = float(price_data.get("avg_price", 0))
    except (ValueError, TypeError):
        avg_price = None

    if not avg_price or avg_price <= 0:
        return None

    try:
        min_price = float(price_data.get("min_price", 0)) or None
        max_price = float(price_data.get("max_price", 0)) or None
    except (ValueError, TypeError):
        min_price = None
        max_price = None

    qty_sold = 0
    try:
        qty_sold = int(price_data.get("unit_quantity", 0))
    except (ValueError, TypeError):
        pass

    return {
        "avg_price": avg_price,
        "min_price": min_price,
        "max_price": max_price,
        "qty_sold": qty_sold,
    }


def _build_bricklink_url(set_num_plain: str) -> str:
    """Build the BrickLink catalog page URL for a set."""
    return f"https://www.bricklink.com/v2/catalog/catalogitem.page?S={set_num_plain}-1"


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
    """Insert or update an offer row. Match by (set_num, store). Returns True if new."""
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

def run_bricklink_prices() -> dict:
    """
    Fetch BrickLink aftermarket prices for sets.

    Called by:
    - APScheduler (daily at 5 AM UTC)
    - POST /admin/pipelines/bricklink_prices/run
    """
    logger.info("Starting BrickLink price fetch...")
    t0 = time.time()

    creds = _get_credentials()
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
        logger.info("Will process %d sets for BrickLink prices", len(sets_to_process))

        with httpx.Client(timeout=REQUEST_TIMEOUT) as client:
            for s in sets_to_process:
                plain = s["set_num_plain"]
                stats["sets_processed"] += 1

                result = _fetch_price_guide(client, creds, plain)

                if result and result.get("avg_price"):
                    stats["prices_found"] += 1

                    is_new = _upsert_offer(
                        db, plain, "BrickLink",
                        result["avg_price"],
                        "USD",
                        _build_bricklink_url(plain),
                        None,  # in_stock unknown from price guide
                    )
                    if is_new:
                        stats["offers_inserted"] += 1
                    else:
                        stats["offers_updated"] += 1
                elif result is None:
                    stats["skipped_no_data"] += 1
                else:
                    stats["api_errors"] += 1

                db.commit()
                time.sleep(THROTTLE_SECONDS)

                # Log progress every 100 sets
                if stats["sets_processed"] % 100 == 0:
                    logger.info(
                        "BrickLink progress: %d/%d processed, %d prices found",
                        stats["sets_processed"],
                        len(sets_to_process),
                        stats["prices_found"],
                    )

        stats["elapsed_seconds"] = round(time.time() - t0, 1)
        stats["completed_at"] = datetime.now(timezone.utc).isoformat()
        logger.info("BrickLink price fetch complete: %s", stats)
        return stats

    except Exception:
        db.rollback()
        logger.exception("BrickLink price fetch failed")
        return {
            "error": "bricklink_fetch_failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            **stats,
        }
    finally:
        db.close()
