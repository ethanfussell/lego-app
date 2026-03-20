"""
Shared scraping utilities used by price_scraper and retailer_scraper.
"""
from __future__ import annotations

import json
import logging
from typing import Optional

from bs4 import BeautifulSoup

logger = logging.getLogger("bricktrack.pipeline.scraper_utils")

# Common browser-like headers for HTTP requests.
SCRAPER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
    "Accept": "text/html,application/xhtml+xml",
    "Accept-Language": "en-US,en;q=0.9",
}


def extract_jsonld_product_offer(html: str) -> Optional[dict]:
    """
    Extract price, currency, and stock status from JSON-LD ``Product`` schema.

    Looks for ``<script type="application/ld+json">`` blocks containing a
    ``Product`` with an ``offers`` sub-object.  Handles both single objects
    and arrays.

    Returns ``{"price": float, "currency": str, "in_stock": bool|None}``
    on success, or ``None`` if no usable product data is found.
    """
    soup = BeautifulSoup(html, "html.parser")

    for script in soup.find_all("script", type="application/ld+json"):
        try:
            data = json.loads(script.string or "")
        except (json.JSONDecodeError, TypeError):
            continue

        items = data if isinstance(data, list) else [data]

        for item in items:
            if not isinstance(item, dict):
                continue

            # Support both direct Product and nested @graph structures
            if item.get("@type") == "Product":
                result = _parse_product_offers(item)
                if result:
                    return result

            # Some sites nest products inside @graph
            if "@graph" in item and isinstance(item["@graph"], list):
                for node in item["@graph"]:
                    if isinstance(node, dict) and node.get("@type") == "Product":
                        result = _parse_product_offers(node)
                        if result:
                            return result

    return None


def _parse_product_offers(product: dict) -> Optional[dict]:
    """Parse the ``offers`` field of a JSON-LD Product dict."""
    offers = product.get("offers", {})

    # offers can be a single object, a list, or an AggregateOffer
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    elif isinstance(offers, dict) and offers.get("@type") == "AggregateOffer":
        # Use lowPrice from AggregateOffer
        price = _coerce_price(offers.get("lowPrice"))
        currency = offers.get("priceCurrency", "USD") if isinstance(offers.get("priceCurrency"), str) else "USD"
        in_stock = _parse_availability(offers.get("availability"))
        if price is not None:
            return {"price": price, "currency": currency, "in_stock": in_stock}
        return None

    price = _coerce_price(offers.get("price"))
    currency = offers.get("priceCurrency", "USD") if isinstance(offers.get("priceCurrency"), str) else "USD"
    in_stock = _parse_availability(offers.get("availability"))

    if price is not None:
        return {"price": price, "currency": currency, "in_stock": in_stock}

    return None


def _coerce_price(raw: object) -> Optional[float]:
    """Coerce a raw price value to float, returning None on failure."""
    if isinstance(raw, (int, float)):
        return float(raw)
    if isinstance(raw, str):
        try:
            return float(raw)
        except ValueError:
            return None
    return None


def _parse_availability(availability: object) -> Optional[bool]:
    """Parse schema.org availability string to bool."""
    s = str(availability or "")
    if "InStock" in s:
        return True
    if "OutOfStock" in s:
        return False
    return None
