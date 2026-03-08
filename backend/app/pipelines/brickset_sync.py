# backend/app/pipelines/brickset_sync.py
"""
Brickset API sync pipeline.

Syncs retail prices, availability status, launch/exit dates, and more
for all sets in the database using the Brickset API v3.

API docs: https://brickset.com/article/52664/api-version-3-documentation
Rate limit: 100 calls/day on free tier (pageSize up to 500 per call).
"""

from __future__ import annotations

import json
import logging
import os
import time
from datetime import datetime, timezone

import httpx
from sqlalchemy import select, and_
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Set as SetModel, Offer as OfferModel, get_locked_fields

logger = logging.getLogger(__name__)

BRICKSET_API_URL = "https://brickset.com/api/v3.asmx/getSets"
PAGE_SIZE = 500  # Max allowed by Brickset


def _get_api_key() -> str:
    key = os.getenv("BRICKSET_API_KEY", "")
    if not key:
        raise RuntimeError("BRICKSET_API_KEY not set in environment")
    return key


def _parse_date(val: str | None) -> str | None:
    """Parse a Brickset datetime string to YYYY-MM-DD."""
    if not val:
        return None
    try:
        dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
        return dt.strftime("%Y-%m-%d")
    except (ValueError, AttributeError):
        return None


def _determine_status(bs_set: dict) -> str:
    """
    Determine availability status from Brickset data.

    Priority order:
    1. exitDate in the past → "retired"
    2. exitDate within 12 months → "retiring_soon"
    3. Brickset availability = "Retail"/"Retail - limited" → "available"
    4. Brickset availability = "Retired" → "retired"
    5. released=False → "unknown" (announced but not out yet)
    6. Old set (year + 3 < current year) → "retired"
    7. Otherwise → "unknown"

    NOTE: Brickset's LEGOCom.US.retailPrice is the *historical* MSRP,
    NOT a signal that the set is currently available for purchase.
    Only the `availability` field reliably indicates current availability.
    """
    now = datetime.now(timezone.utc)

    # 1-2: Check exitDate
    exit_raw = bs_set.get("exitDate")
    if exit_raw:
        try:
            exit_dt = datetime.fromisoformat(exit_raw.replace("Z", "+00:00"))
            if exit_dt < now:
                return "retired"
            # Within 12 months of exit → retiring soon
            months_until_exit = (exit_dt.year - now.year) * 12 + (exit_dt.month - now.month)
            if months_until_exit <= 12:
                return "retiring_soon"
        except (ValueError, AttributeError):
            pass

    # 3-4: Check availability field (the ONLY reliable source for current availability)
    avail = (bs_set.get("availability") or "").strip()
    if avail in ("Retail", "Retail - limited"):
        return "available"
    if avail in ("Retired",):
        return "retired"

    # 5: Not yet released
    if bs_set.get("released") is False:
        return "unknown"

    # 6: Old sets without explicit availability data are retired
    set_year = bs_set.get("year")
    if isinstance(set_year, (int, str)):
        try:
            if int(set_year) + 3 < now.year:
                return "retired"
        except (ValueError, TypeError):
            pass

    return "unknown"


def _upsert_lego_offer(db: Session, plain_num: str, price: float | None, in_stock: bool | None) -> bool:
    """Upsert a LEGO.com offer. Returns True if new row inserted."""
    if price is None:
        return False

    existing = db.execute(
        select(OfferModel).where(
            and_(OfferModel.set_num == plain_num, OfferModel.store == "LEGO")
        )
    ).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    url = f"https://www.lego.com/en-us/product/{plain_num}"

    if existing:
        existing.price = price
        existing.in_stock = in_stock
        existing.last_checked = now
        existing.url = url
        return False
    else:
        db.add(OfferModel(
            set_num=plain_num,
            store="LEGO",
            price=price,
            currency="USD",
            url=url,
            in_stock=in_stock,
            last_checked=now,
        ))
        return True


def _fetch_sets_by_year(api_key: str, year: int) -> list[dict]:
    """Fetch all sets for a given year from Brickset API, handling pagination."""
    all_sets = []
    page = 1

    while True:
        params = {
            "apiKey": api_key,
            "userHash": "",
            "params": json.dumps({
                "year": str(year),
                "pageSize": PAGE_SIZE,
                "pageNumber": page,
                "extendedData": 1,
            }),
        }

        resp = httpx.get(BRICKSET_API_URL, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") != "success":
            logger.warning("Brickset API error for year %d page %d: %s", year, page, data.get("message", "unknown"))
            break

        sets = data.get("sets", [])
        if not sets:
            break

        all_sets.extend(sets)
        matches = data.get("matches", 0)

        if len(all_sets) >= matches:
            break

        page += 1
        time.sleep(1)  # Be polite to the API

    return all_sets


def run_brickset_sync(years: list[int] | None = None) -> dict:
    """
    Sync set data from Brickset API.

    By default syncs years 2020-2026 (recent/current sets most likely to have
    price and availability changes). Pass specific years to override.
    """
    api_key = _get_api_key()

    if years is None:
        current_year = datetime.now().year
        years = list(range(current_year - 6, current_year + 1))

    db: Session = SessionLocal()
    t0 = time.time()

    stats = {
        "years_synced": years,
        "sets_fetched": 0,
        "sets_updated": 0,
        "sets_not_in_db": 0,
        "offers_inserted": 0,
        "offers_updated": 0,
        "api_calls": 0,
    }

    try:
        for year in years:
            logger.info("Brickset sync: fetching year %d...", year)
            bs_sets = _fetch_sets_by_year(api_key, year)
            stats["api_calls"] += (len(bs_sets) // PAGE_SIZE) + 1
            stats["sets_fetched"] += len(bs_sets)

            for bs in bs_sets:
                number = bs.get("number", "")
                variant = bs.get("numberVariant", 1)
                set_num = f"{number}-{variant}"

                # Find in our DB
                row = db.execute(
                    select(SetModel).where(SetModel.set_num == set_num)
                ).scalar_one_or_none()

                if not row:
                    stats["sets_not_in_db"] += 1
                    continue

                # --- Update set fields (skip admin-locked) ---
                updated = False
                locked = set(get_locked_fields(row))

                # Availability status
                new_status = _determine_status(bs)
                if "retirement_status" not in locked and new_status and row.retirement_status != new_status:
                    row.retirement_status = new_status
                    updated = True

                # Exit date → retirement_date
                exit_date = _parse_date(bs.get("exitDate"))
                if "retirement_date" not in locked and exit_date and row.retirement_date != exit_date:
                    row.retirement_date = exit_date
                    updated = True

                # Launch date
                launch_date = _parse_date(bs.get("launchDate"))
                if "launch_date" not in locked and launch_date and row.launch_date != launch_date:
                    row.launch_date = launch_date
                    updated = True

                # Exit date (raw)
                exit_date_raw = _parse_date(bs.get("exitDate"))
                if "exit_date" not in locked and exit_date_raw and row.exit_date != exit_date_raw:
                    row.exit_date = exit_date_raw
                    updated = True

                # US retail price
                lego_com = bs.get("LEGOCom", {})
                us_data = lego_com.get("US", {})
                us_price = us_data.get("retailPrice") if us_data else None

                if "retail_price" not in locked and us_price is not None and row.retail_price != us_price:
                    row.retail_price = us_price
                    row.retail_currency = "USD"
                    updated = True

                # Description (strip HTML tags + entities)
                desc_raw = bs.get("extendedData", {}).get("description") if bs.get("extendedData") else None
                if "description" not in locked and desc_raw and isinstance(desc_raw, str):
                    import re
                    import html as html_mod
                    desc_clean = re.sub(r"<[^>]+>", "", desc_raw)
                    desc_clean = html_mod.unescape(desc_clean).strip()
                    if desc_clean and row.description != desc_clean:
                        row.description = desc_clean
                        updated = True

                # Subtheme
                subtheme = bs.get("subtheme")
                if "subtheme" not in locked and subtheme and row.subtheme != subtheme:
                    row.subtheme = subtheme
                    updated = True

                # Minifigs
                minifigs = bs.get("minifigs")
                if "minifigs" not in locked and minifigs is not None and row.minifigs != minifigs:
                    row.minifigs = minifigs
                    updated = True

                # Age range
                age_range = bs.get("ageRange", {})
                if age_range:
                    age_min = age_range.get("min")
                    age_max = age_range.get("max")
                    if "age_min" not in locked and age_min is not None and row.age_min != age_min:
                        row.age_min = age_min
                        updated = True
                    if "age_max" not in locked and age_max is not None and row.age_max != age_max:
                        row.age_max = age_max
                        updated = True

                # Dimensions
                dims = bs.get("dimensions", {})
                if dims:
                    for attr, key in [("dimensions_height", "height"), ("dimensions_width", "width"), ("dimensions_depth", "depth")]:
                        if attr not in locked:
                            val = dims.get(key)
                            if val is not None and getattr(row, attr) != val:
                                setattr(row, attr, val)
                                updated = True
                    if "weight_kg" not in locked:
                        weight = dims.get("weight")
                        if weight is not None and row.weight_kg != weight:
                            row.weight_kg = weight
                            updated = True

                # Barcodes
                barcode = bs.get("barcode", {})
                if barcode:
                    ean = barcode.get("EAN")
                    upc = barcode.get("UPC")
                    if "barcode_ean" not in locked and ean and row.barcode_ean != ean:
                        row.barcode_ean = ean
                        updated = True
                    if "barcode_upc" not in locked and upc and row.barcode_upc != upc:
                        row.barcode_upc = upc
                        updated = True

                if updated:
                    stats["sets_updated"] += 1

                # --- Upsert LEGO.com offer (only for sets currently sold) ---
                if new_status in ("available", "retiring_soon") and us_price:
                    is_new = _upsert_lego_offer(
                        db, number, us_price,
                        True if new_status == "available" else None,
                    )
                    if is_new:
                        stats["offers_inserted"] += 1
                    else:
                        stats["offers_updated"] += 1

            db.commit()
            logger.info("Brickset sync: year %d done (%d sets)", year, len(bs_sets))
            time.sleep(1)

        stats["elapsed_seconds"] = round(time.time() - t0, 1)
        stats["completed_at"] = datetime.now(timezone.utc).isoformat()
        logger.info("Brickset sync complete: %s", stats)
        return stats

    except Exception:
        db.rollback()
        logger.exception("Brickset sync failed")
        return {
            "error": "brickset_sync_failed",
            "completed_at": datetime.now(timezone.utc).isoformat(),
            **stats,
        }
    finally:
        db.close()
