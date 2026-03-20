"""
Shared utilities for matching retailer search results to LEGO sets.

Used by bestbuy_prices, walmart_prices, and target_prices pipelines.
"""
from __future__ import annotations

import re
from typing import Optional


def match_lego_product(
    candidates: list[dict],
    set_num_plain: str,
    retail_price: Optional[float] = None,
) -> Optional[dict]:
    """
    Pick the best matching LEGO product from a list of search result candidates.

    Each candidate dict must have:
      - "title": str (product name)
      - "price": float | None
    And may have any other retailer-specific fields (preserved in return).

    Returns the best matching candidate dict, or None.
    """
    if not candidates:
        return None

    # Build a pattern that matches the set number as a whole word/token
    # e.g. "10305" should match "LEGO 10305 Castle" but not "103051"
    num_pattern = re.compile(rf"(?<!\d){re.escape(set_num_plain)}(?!\d)")

    scored: list[tuple[int, dict]] = []

    for c in candidates:
        title = c.get("title", "")
        price = c.get("price")

        # Must contain "LEGO" (case-insensitive)
        if not re.search(r"lego", title, re.IGNORECASE):
            continue

        # Must contain the set number as a whole token
        if not num_pattern.search(title):
            continue

        # Score the match
        score = 0

        # Exact set number match in title gets highest priority
        score += 10

        # If we know the MSRP, penalize results that are >80% more expensive
        # (likely bundles or accessories)
        if retail_price and price:
            ratio = price / retail_price
            if ratio > 1.8:
                score -= 5  # likely a bundle
            elif 0.5 <= ratio <= 1.5:
                score += 3  # reasonable price range

        # Penalize minifigure packs / accessories
        title_lower = title.lower()
        if any(kw in title_lower for kw in ("minifigure pack", "accessory", "key chain", "keychain")):
            score -= 8

        scored.append((score, c))

    if not scored:
        return None

    # Sort by score desc, then by price asc (cheapest of same score = base set)
    scored.sort(key=lambda x: (-x[0], x[1].get("price") or 999999))
    return scored[0][1]
