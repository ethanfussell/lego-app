# backend/app/pipelines/new_sets_scraper.py
"""
Pipeline: Discover new LEGO sets from LEGO.com and create DB entries.

Unlike coming_soon_scraper (which only updates existing rows), this pipeline
creates new Set rows for sets found on LEGO.com that don't yet exist in the DB.
This fills the gap where Rebrickable lags behind official LEGO releases.

Sources:
  - LEGO.com "New Sets and Products" category page
  - LEGO.com individual product pages (JSON-LD structured data)
"""
from __future__ import annotations

import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import Set as SetModel, get_locked_fields

logger = logging.getLogger("bricktrack.pipeline.new_sets")

NEW_SETS_URL = "https://www.lego.com/en-us/categories/new-sets-and-products"
LEGO_PRODUCT_URL = "https://www.lego.com/en-us/product/"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

REQUEST_TIMEOUT = 25.0
THROTTLE_SECONDS = 2.0


def _extract_set_numbers_from_html(html: str) -> list[str]:
    """Extract LEGO set numbers from a category page."""
    soup = BeautifulSoup(html, "html.parser")
    set_nums: list[str] = []
    seen: set[str] = set()

    for link in soup.find_all("a", href=True):
        href = link["href"]
        match = re.search(r"/product/[^/]*?(\d{5,6})(?:[^/\d]|$)", href)
        if match:
            num = match.group(1)
            if num not in seen:
                seen.add(num)
                set_nums.append(num)

    for script in soup.find_all("script", type="application/json"):
        try:
            data = json.loads(script.string or "")
            _extract_nums_from_json(data, seen, set_nums)
        except (json.JSONDecodeError, TypeError):
            continue

    for script in soup.find_all("script"):
        text = script.string or ""
        for num in re.findall(r'"productId"\s*:\s*"(\d{5,6})"', text):
            if num not in seen:
                seen.add(num)
                set_nums.append(num)

    return set_nums


def _extract_nums_from_json(obj: object, seen: set[str], out: list[str]) -> None:
    if isinstance(obj, dict):
        for key, val in obj.items():
            if key in ("productId", "productCode", "setNumber") and isinstance(val, str):
                match = re.match(r"^(\d{5,6})$", val)
                if match and val not in seen:
                    seen.add(val)
                    out.append(val)
            else:
                _extract_nums_from_json(val, seen, out)
    elif isinstance(obj, list):
        for item in obj:
            _extract_nums_from_json(item, seen, out)


def _scrape_product_page(client: httpx.Client, set_num_plain: str) -> Optional[dict]:
    """Scrape a LEGO.com product page for name, price, image, theme via JSON-LD."""
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
            result["image"] = item.get("image")

            # Try to extract theme from breadcrumb or category
            brand = item.get("brand", {})
            if isinstance(brand, dict):
                result["brand"] = brand.get("name")

            offers = item.get("offers", {})
            if isinstance(offers, list):
                offers = offers[0] if offers else {}

            raw_price = offers.get("price")
            if isinstance(raw_price, (int, float)):
                result["price"] = float(raw_price)
            elif isinstance(raw_price, str):
                try:
                    result["price"] = float(raw_price)
                except ValueError:
                    pass

            result["currency"] = offers.get("priceCurrency", "USD")

            availability = str(offers.get("availability", ""))
            if "PreOrder" in availability:
                result["availability"] = "coming_soon"
            elif "InStock" in availability:
                result["availability"] = "available"
            elif "OutOfStock" in availability:
                result["availability"] = "out_of_stock"
            elif "ComingSoon" in availability or "BackOrder" in availability:
                result["availability"] = "coming_soon"
            else:
                result["availability"] = "unknown"

            break

    # Try to extract theme from page (breadcrumb, meta, etc.)
    page_text = resp.text

    # Look for theme in breadcrumb JSON-LD
    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue
        items = data if isinstance(data, list) else [data]
        for item in items:
            if isinstance(item, dict) and item.get("@type") == "BreadcrumbList":
                crumbs = item.get("itemListElement", [])
                # Theme is usually the 3rd breadcrumb (Home > Themes > ThemeName)
                for crumb in crumbs:
                    pos = crumb.get("position", 0)
                    if pos == 3:
                        result["theme"] = crumb.get("name")
                        break

    # Extract piece count from page text
    pieces_match = re.search(r"(\d{1,5})\s*(?:pieces|pcs|Pieces)", page_text)
    if pieces_match:
        result["pieces"] = int(pieces_match.group(1))

    # Try to find a launch date
    date_match = re.search(
        r"(?:available|releases?|launching?|arrives?)\s+(?:on\s+)?(\w+\s+\d{1,2},?\s+\d{4})",
        soup.get_text(separator=" "),
        re.IGNORECASE,
    )
    if date_match:
        try:
            dt = datetime.strptime(date_match.group(1).replace(",", ""), "%B %d %Y")
            result["launch_date"] = dt.strftime("%Y-%m-%d")
        except ValueError:
            pass

    # Extract image from og:image meta tag as fallback
    if "image" not in result:
        og_image = soup.find("meta", property="og:image")
        if og_image and og_image.get("content"):
            result["image"] = og_image["content"]

    return result if result.get("name") else None


def _infer_theme_from_name(name: str) -> str:
    """Best-effort theme inference from set name keywords."""
    name_lower = name.lower()
    theme_keywords = {
        "Star Wars": ["star wars", "mandalorian", "lightsaber", "jedi", "sith", "darth"],
        "Harry Potter": ["harry potter", "hogwarts", "wizarding", "quidditch"],
        "Marvel": ["marvel", "avengers", "spider-man", "iron man", "thor"],
        "DC": ["batman", "gotham", "dc super", "joker", "justice league"],
        "Disney": ["disney", "frozen", "moana", "encanto", "princess"],
        "Technic": ["technic"],
        "City": ["city"],
        "Friends": ["friends"],
        "Ninjago": ["ninjago"],
        "Creator": ["creator"],
        "Icons": ["icons"],
        "Ideas": ["ideas"],
        "Architecture": ["architecture"],
        "Speed Champions": ["speed champions"],
        "Minecraft": ["minecraft"],
        "Super Mario": ["super mario"],
        "Duplo": ["duplo"],
        "Sonic": ["sonic"],
        "Animal Crossing": ["animal crossing"],
    }
    for theme, keywords in theme_keywords.items():
        for kw in keywords:
            if kw in name_lower:
                return theme
    return "Other"


def run_new_sets_scrape() -> dict:
    """
    Scrape LEGO.com new-sets page and create DB entries for missing sets.

    This fills gaps where Rebrickable hasn't catalogued a set yet but
    LEGO.com is already selling it.
    """
    logger.info("Starting new-sets discovery from LEGO.com...")
    t0 = time.time()

    db: Session = SessionLocal()
    stats = {
        "page_sets_found": 0,
        "already_in_db": 0,
        "new_sets_created": 0,
        "existing_sets_updated": 0,
        "product_pages_checked": 0,
        "scrape_failures": 0,
    }

    try:
        with httpx.Client(timeout=REQUEST_TIMEOUT, follow_redirects=True) as client:
            # Fetch the new-sets category page
            try:
                resp = client.get(NEW_SETS_URL, headers=HEADERS, follow_redirects=True)
                if resp.status_code != 200:
                    logger.warning("Got status %d from %s", resp.status_code, NEW_SETS_URL)
                    return {"error": f"status_{resp.status_code}", "url": NEW_SETS_URL}
                set_nums = _extract_set_numbers_from_html(resp.text)
            except httpx.HTTPError as e:
                logger.warning("Failed to fetch %s: %s", NEW_SETS_URL, e)
                return {"error": "fetch_failed", "url": NEW_SETS_URL}

            stats["page_sets_found"] = len(set_nums)
            logger.info("Found %d set numbers from LEGO.com new-sets page", len(set_nums))

            now = datetime.now(timezone.utc)
            current_month = now.strftime("%Y-%m-%d")

            for plain_num in set_nums:
                set_num = f"{plain_num}-1"
                stats["product_pages_checked"] += 1

                # Check if already in DB
                row = db.execute(
                    select(SetModel).where(SetModel.set_num == set_num)
                ).scalar_one_or_none()

                if row:
                    stats["already_in_db"] += 1
                    # Update launch_date if missing (set was in DB but lacked date)
                    locked = set(get_locked_fields(row))
                    changed = False

                    if not row.launch_date and "launch_date" not in locked:
                        # Scrape product page for launch date
                        product = _scrape_product_page(client, plain_num)
                        if product:
                            launch = product.get("launch_date")
                            if launch:
                                row.launch_date = launch
                                changed = True
                            elif not row.launch_date:
                                # Set is on new-sets page, so it's launched — use current month
                                row.launch_date = now.strftime("%Y-%m-01")
                                changed = True

                            # Also update price/status if missing
                            if not row.retail_price and product.get("price") and "retail_price" not in locked:
                                row.retail_price = product["price"]
                                row.retail_currency = product.get("currency", "USD")
                                changed = True

                            avail = product.get("availability", "")
                            if avail in ("available",) and row.retirement_status != "available":
                                if "retirement_status" not in locked:
                                    row.retirement_status = "available"
                                    changed = True

                        else:
                            # Couldn't scrape but it's on new-sets page
                            if not row.launch_date and "launch_date" not in locked:
                                row.launch_date = now.strftime("%Y-%m-01")
                                changed = True

                        if changed:
                            stats["existing_sets_updated"] += 1
                        time.sleep(THROTTLE_SECONDS)
                    continue

                # Not in DB — scrape product page for details
                product = _scrape_product_page(client, plain_num)
                time.sleep(THROTTLE_SECONDS)

                if not product:
                    stats["scrape_failures"] += 1
                    continue

                name = product.get("name", f"LEGO Set {plain_num}")
                theme = product.get("theme") or _infer_theme_from_name(name)
                launch_date = product.get("launch_date") or now.strftime("%Y-%m-01")

                new_set = SetModel(
                    set_num=set_num,
                    name=name,
                    year=now.year,
                    theme=theme,
                    pieces=product.get("pieces"),
                    image_url=product.get("image"),
                    retail_price=product.get("price"),
                    retail_currency=product.get("currency", "USD"),
                    launch_date=launch_date,
                    retirement_status=product.get("availability", "available"),
                )
                db.add(new_set)
                stats["new_sets_created"] += 1
                logger.info("Created new set: %s - %s", set_num, name)

                # Commit every 10 sets to avoid large transactions
                if stats["new_sets_created"] % 10 == 0:
                    db.commit()

            db.commit()

        stats["elapsed_seconds"] = round(time.time() - t0, 1)
        stats["completed_at"] = now.isoformat()
        logger.info("New-sets scrape complete: %s", stats)
        return stats

    except Exception:
        db.rollback()
        logger.exception("New-sets scrape failed")
        return {"error": "scrape_failed", "completed_at": datetime.now(timezone.utc).isoformat()}
    finally:
        db.close()
