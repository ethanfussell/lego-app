"""
Pipeline: Scrape LEGO.com for coming-soon / unreleased sets.

Strategy:
1. Fetch LEGO.com category page for "coming soon" set numbers
2. For each set, scrape the product page JSON-LD for price/availability
3. Mark matching DB sets as coming_soon with launch dates when available

Uses curl_cffi to impersonate a real browser's TLS fingerprint,
bypassing Cloudflare/bot detection that blocks plain httpx/requests.

Sources:
  - LEGO.com "Coming Soon" category page
  - LEGO.com individual product pages (JSON-LD structured data)
"""
from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Optional

from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Set as SetModel, get_locked_fields

logger = logging.getLogger("bricktrack.pipeline.coming_soon")

# LEGO.com URLs
COMING_SOON_URL = "https://www.lego.com/en-us/categories/coming-soon"
NEW_SETS_URL = "https://www.lego.com/en-us/categories/new-sets-and-products"
LEGO_PRODUCT_URL = "https://www.lego.com/en-us/product/"

HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

REQUEST_TIMEOUT = 25.0
THROTTLE_SECONDS = 2.0

# Browser to impersonate for TLS fingerprinting
BROWSER_IMPERSONATE = "chrome120"


def _create_session():
    """Create an HTTP session with browser TLS impersonation.

    Uses curl_cffi to replicate a real Chrome browser's TLS handshake,
    HTTP/2 settings, and cipher suite order. Falls back to httpx if
    curl_cffi is not available.
    """
    try:
        from curl_cffi.requests import Session as CurlSession  # noqa: I001

        session = CurlSession(impersonate=BROWSER_IMPERSONATE, timeout=REQUEST_TIMEOUT)
        session._is_curl = True
        logger.info("Using curl_cffi with %s impersonation", BROWSER_IMPERSONATE)
        return session
    except ImportError:
        import httpx

        logger.warning("curl_cffi not installed, falling back to httpx (may get 403s)")
        client = httpx.Client(timeout=REQUEST_TIMEOUT, follow_redirects=True)
        client._is_curl = False  # type: ignore[attr-defined]
        return client


def _safe_get(session, url: str, **kwargs):
    """GET request that works with both curl_cffi and httpx sessions."""
    is_curl = getattr(session, "_is_curl", False)
    if is_curl:
        return session.get(url, headers=HEADERS, allow_redirects=True, **kwargs)
    else:
        return session.get(url, headers=HEADERS, follow_redirects=True, **kwargs)


def _extract_set_numbers_from_html(html: str) -> list[str]:
    """
    Extract LEGO set numbers from a category page.

    LEGO.com product URLs follow the pattern /product/set-name-NNNNN
    where NNNNN is the set number (5-6 digits at the end of the slug).
    """
    soup = BeautifulSoup(html, "html.parser")
    set_nums: list[str] = []
    seen: set[str] = set()

    # Look for product links: /en-us/product/something-12345
    for link in soup.find_all("a", href=True):
        href = link["href"]
        match = re.search(r"/product/[^/]*?(\d{5,6})(?:[^/\d]|$)", href)
        if match:
            num = match.group(1)
            if num not in seen:
                seen.add(num)
                set_nums.append(num)

    # Try JSON data embedded in script tags (Next.js page data)
    for script in soup.find_all("script", type="application/json"):
        try:
            data = json.loads(script.string or "")
            _extract_nums_from_json(data, seen, set_nums)
        except (json.JSONDecodeError, TypeError):
            continue

    # Check __NEXT_DATA__ and other embedded scripts
    for script in soup.find_all("script"):
        sid = script.get("id", "")
        text = script.string or ""

        # Next.js __NEXT_DATA__ contains page props
        if sid == "__NEXT_DATA__":
            try:
                data = json.loads(text)
                _extract_nums_from_json(data, seen, set_nums)
            except (json.JSONDecodeError, TypeError):
                pass
            continue

        # Fallback: regex for product IDs in any script
        for num in re.findall(r'"productId"\s*:\s*"(\d{5,6})"', text):
            if num not in seen:
                seen.add(num)
                set_nums.append(num)
        for num in re.findall(r'"set_num(?:ber)?"\s*:\s*"(\d{5,6})"', text):
            if num not in seen:
                seen.add(num)
                set_nums.append(num)
        # Also catch product codes in embedded JSON
        for num in re.findall(r'"productCode"\s*:\s*"(\d{5,6})"', text):
            if num not in seen:
                seen.add(num)
                set_nums.append(num)

    return set_nums


def _extract_nums_from_json(obj: object, seen: set[str], out: list[str]) -> None:
    """Recursively extract set numbers from embedded JSON data."""
    if isinstance(obj, dict):
        for key, val in obj.items():
            if key in ("productId", "productCode", "setNumber", "variantId") and isinstance(val, str):
                match = re.match(r"^(\d{5,6})$", val)
                if match and val not in seen:
                    seen.add(val)
                    out.append(val)
            else:
                _extract_nums_from_json(val, seen, out)
    elif isinstance(obj, list):
        for item in obj:
            _extract_nums_from_json(item, seen, out)


def _scrape_product_page(
    session,
    set_num_plain: str,
) -> Optional[dict]:
    """
    Scrape a LEGO.com product page for availability and price via JSON-LD.

    Returns dict with price, availability status, etc., or None if unavailable.
    """
    url = f"{LEGO_PRODUCT_URL}{set_num_plain}"

    try:
        resp = _safe_get(session, url)
        if resp.status_code == 404:
            return None
        if resp.status_code == 403:
            logger.warning("Got 403 from LEGO.com for set %s", set_num_plain)
            return None
        if resp.status_code != 200:
            logger.warning("Got status %d from LEGO.com for set %s", resp.status_code, set_num_plain)
            return None
    except Exception:
        logger.debug("Failed to fetch LEGO.com page for %s", set_num_plain)
        return None

    soup = BeautifulSoup(resp.text, "html.parser")
    result: dict = {"url": str(resp.url), "set_num_plain": set_num_plain}

    # Parse JSON-LD structured data
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue

        items = data if isinstance(data, list) else [data]
        for item in items:
            if not isinstance(item, dict) or item.get("@type") != "Product":
                continue

            result["name"] = item.get("name")

            offers = item.get("offers", {})
            if isinstance(offers, list):
                offers = offers[0] if offers else {}

            # Price
            raw_price = offers.get("price")
            if isinstance(raw_price, (int, float)):
                result["price"] = float(raw_price)
            elif isinstance(raw_price, str):
                try:
                    result["price"] = float(raw_price)
                except ValueError:
                    pass

            result["currency"] = offers.get("priceCurrency", "USD")

            # Availability status
            availability = str(offers.get("availability", ""))
            if "PreOrder" in availability:
                result["availability"] = "pre_order"
            elif "InStock" in availability:
                result["availability"] = "in_stock"
            elif "OutOfStock" in availability:
                result["availability"] = "out_of_stock"
            elif "ComingSoon" in availability or "BackOrder" in availability:
                result["availability"] = "coming_soon"
            else:
                result["availability"] = "unknown"

            break

    # Also check page text for "Coming Soon" indicators
    page_text = soup.get_text(separator=" ")
    if re.search(r"coming\s+soon", page_text, re.IGNORECASE):
        if result.get("availability") in (None, "unknown"):
            result["availability"] = "coming_soon"

    # Try to find a release/launch date on the page
    date_match = re.search(
        r"(?:available|releases?|launching?|arrives?)\s+(?:on\s+)?(\w+\s+\d{1,2},?\s+\d{4})",
        page_text,
        re.IGNORECASE,
    )
    if date_match:
        try:
            dt = datetime.strptime(
                date_match.group(1).replace(",", ""), "%B %d %Y"
            )
            result["launch_date"] = dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    return result if len(result) > 2 else None


def _fetch_coming_soon_page(session) -> list[str]:
    """Fetch LEGO.com coming-soon category page and extract set numbers."""
    set_nums: list[str] = []

    for url in [COMING_SOON_URL, NEW_SETS_URL]:
        try:
            resp = _safe_get(session, url)
            if resp.status_code == 200:
                nums = _extract_set_numbers_from_html(resp.text)
                logger.info("Extracted %d set numbers from %s", len(nums), url)
                set_nums.extend(nums)
            else:
                logger.warning("Got status %d from %s", resp.status_code, url)
        except Exception:
            logger.warning("Failed to fetch %s", url, exc_info=True)

        time.sleep(THROTTLE_SECONDS)

    # Deduplicate
    seen: set[str] = set()
    deduped: list[str] = []
    for n in set_nums:
        if n not in seen:
            seen.add(n)
            deduped.append(n)

    return deduped


def run_coming_soon_scrape() -> dict:
    """
    Scrape LEGO.com for coming-soon sets and update the database.

    Called by:
    - POST /admin/pipelines/coming_soon_scrape/run
    """
    logger.info("Starting coming-soon scrape from LEGO.com...")
    t0 = time.time()

    db: Session = SessionLocal()
    stats = {
        "page_sets_found": 0,
        "product_pages_checked": 0,
        "sets_matched": 0,
        "sets_updated": 0,
        "coming_soon_found": 0,
    }

    try:
        session = _create_session()
        try:
            # Phase 1: Get set numbers from the LEGO.com coming-soon page
            category_nums = _fetch_coming_soon_page(session)
            stats["page_sets_found"] = len(category_nums)
            logger.info("Found %d set numbers from category pages", len(category_nums))

            # Track which DB set_nums we flag as coming soon this run
            flagged_set_nums: set[str] = set()

            # Phase 2: Also check sets already flagged in DB
            # (to update their status if they've launched)
            db_coming = db.execute(
                select(SetModel.set_num).where(
                    SetModel.lego_com_coming_soon.is_(True)
                )
            ).scalars().all()

            db_nums_plain = set()
            for sn in db_coming:
                plain = sn.split("-")[0] if sn else sn
                db_nums_plain.add(plain)

            # Combine both sources, deduplicate
            all_nums = list(dict.fromkeys(category_nums + list(db_nums_plain)))
            logger.info("Will check %d total set numbers", len(all_nums))

            # Convert category_nums to a set for O(1) lookup
            category_nums_set = set(category_nums)

            # Phase 3: Scrape individual product pages
            for plain_num in all_nums:
                stats["product_pages_checked"] += 1
                product_data = _scrape_product_page(session, plain_num)

                if not product_data:
                    time.sleep(THROTTLE_SECONDS)
                    continue

                # Find in DB (try NNNNN-1 format first)
                row = None
                for set_num in [f"{plain_num}-1", plain_num]:
                    row = db.execute(
                        select(SetModel).where(SetModel.set_num == set_num)
                    ).scalar_one_or_none()
                    if row:
                        break

                if not row:
                    time.sleep(THROTTLE_SECONDS)
                    continue

                stats["sets_matched"] += 1
                locked = set(get_locked_fields(row))
                changed = False

                avail = product_data.get("availability", "")
                on_coming_soon_page = plain_num in category_nums_set

                # Set/clear the lego_com_coming_soon flag
                if on_coming_soon_page:
                    if not row.lego_com_coming_soon:
                        row.lego_com_coming_soon = True
                        changed = True
                    flagged_set_nums.add(row.set_num)
                    stats["coming_soon_found"] += 1

                # Mark as coming_soon if LEGO.com says pre_order or coming_soon
                if avail in ("pre_order", "coming_soon"):
                    if "retirement_status" not in locked and row.retirement_status != "coming_soon":
                        row.retirement_status = "coming_soon"
                        changed = True

                # If LEGO.com says in_stock and we had it as coming_soon, update
                elif avail == "in_stock" and row.retirement_status == "coming_soon":
                    if "retirement_status" not in locked:
                        row.retirement_status = "available"
                        changed = True

                # Update launch_date if found on product page
                launch_date = product_data.get("launch_date")
                if launch_date and "launch_date" not in locked:
                    if row.launch_date != launch_date:
                        row.launch_date = launch_date
                        changed = True

                # Update retail_price from LEGO.com
                price = product_data.get("price")
                if price and "retail_price" not in locked:
                    if row.retail_price != price:
                        row.retail_price = price
                        row.retail_currency = product_data.get("currency", "USD")
                        changed = True

                if changed:
                    stats["sets_updated"] += 1

                db.commit()
                time.sleep(THROTTLE_SECONDS)

            # Phase 4: Clear lego_com_coming_soon for sets no longer on the page
            stale = db.execute(
                select(SetModel).where(
                    SetModel.lego_com_coming_soon.is_(True),
                    SetModel.set_num.notin_(flagged_set_nums) if flagged_set_nums else True,
                )
            ).scalars().all()
            cleared = 0
            for row in stale:
                row.lego_com_coming_soon = False
                cleared += 1
            if cleared:
                db.commit()
                logger.info("Cleared lego_com_coming_soon flag from %d sets", cleared)
            stats["flags_cleared"] = cleared

        finally:
            if hasattr(session, "close"):
                session.close()

        stats["elapsed_seconds"] = round(time.time() - t0, 1)
        stats["completed_at"] = datetime.now(timezone.utc).isoformat()
        logger.info("Coming-soon scrape complete: %s", stats)
        return stats

    except Exception:
        db.rollback()
        logger.exception("Coming-soon scrape failed")
        return {"error": "scrape_failed", "completed_at": datetime.now(timezone.utc).isoformat()}
    finally:
        db.close()
