from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy import func as sa_func, select
from sqlalchemy.orm import Session

from app.models import Offer as OfferModel, Set as SetModel


def _normalize_plain_set_num(v: str) -> str:
    """Accept "76300", "76300-1", " 76300-1 " → "76300"."""
    s = (v or "").strip()
    if not s:
        return ""
    return s.split("-")[0]


def get_offers_for_set(db: Session, plain_set_num: str) -> List[Dict[str, Any]]:
    """Query offers from the database, sorted by stock status then price."""
    key = _normalize_plain_set_num(plain_set_num)
    if not key:
        return []

    rows = db.execute(
        select(OfferModel).where(OfferModel.set_num == key)
    ).scalars().all()

    offers: List[Dict[str, Any]] = []
    for o in rows:
        offers.append({
            "store": o.store,
            "price": o.price,
            "currency": o.currency,
            "url": o.url,
            "in_stock": o.in_stock,
            "updated_at": o.last_checked.isoformat() if o.last_checked else None,
        })

    # Sort: in-stock first, then unknown, then out-of-stock; then cheapest
    def stock_rank(x: Dict[str, Any]) -> int:
        v = x.get("in_stock")
        if v is True:
            return 0
        if v is None:
            return 1
        return 2

    offers.sort(key=lambda o: (stock_rank(o), float(o.get("price") or 0.0)))
    return offers


def get_msrp_for_set(db: Session, plain_set_num: str) -> Optional[Dict[str, Any]]:
    """Get MSRP data for a set."""
    key = _normalize_plain_set_num(plain_set_num)
    if not key:
        return None

    # Try exact match first, then with -1 suffix
    for sn in [f"{key}-1", key]:
        row = db.execute(
            select(SetModel.retail_price, SetModel.retail_currency)
            .where(SetModel.set_num == sn)
        ).one_or_none()
        if row and row.retail_price is not None:
            return {"retail_price": row.retail_price, "retail_currency": row.retail_currency or "USD"}

    return None


# ---------------------------------------------------------------------------
# Batch best-price helpers (for enriching list endpoints)
# ---------------------------------------------------------------------------


def best_prices_for_sets(
    db: Session,
    set_nums: List[str],
) -> Dict[str, float]:
    """
    Given canonical set_nums (e.g. "10305-1"), return a mapping of
    canonical_set_num → cheapest in-stock offer price.

    Uses a single GROUP BY query for efficiency.
    """
    if not set_nums:
        return {}

    # Build plain → canonical lookup (Offer.set_num stores "10305", not "10305-1")
    plain_to_canonical: Dict[str, str] = {}
    seen: set[str] = set()
    plain_nums: List[str] = []
    for sn in set_nums:
        plain = _normalize_plain_set_num(sn)
        if plain and plain not in seen:
            plain_to_canonical.setdefault(plain, sn)
            plain_nums.append(plain)
            seen.add(plain)
    if not plain_nums:
        return {}

    rows = db.execute(
        select(OfferModel.set_num, sa_func.min(OfferModel.price))
        .where(
            OfferModel.set_num.in_(plain_nums),
            OfferModel.price.isnot(None),
            # Include in-stock (True) and unknown (None), exclude out-of-stock (False)
            sa_func.coalesce(OfferModel.in_stock, True).is_(True),
        )
        .group_by(OfferModel.set_num)
    ).all()

    result: Dict[str, float] = {}
    for plain_sn, min_price in rows:
        canonical = plain_to_canonical.get(str(plain_sn))
        if canonical and min_price is not None:
            result[canonical] = float(min_price)

    return result


def enrich_with_best_prices(
    db: Session,
    rows: List[Dict[str, Any]],
) -> None:
    """
    Mutate response dicts in-place: add original_price and sale_price fields.

    - original_price = retail_price (MSRP) — always set when available
    - sale_price = best offer price — only set when strictly less than retail
    """
    set_nums = [r["set_num"] for r in rows if r.get("set_num")]
    if not set_nums:
        return

    best_prices = best_prices_for_sets(db, set_nums)

    # Batch-fetch retail_price for rows that don't already have it
    missing_retail = [
        sn for sn in set_nums
        if not isinstance(
            next((r.get("retail_price") for r in rows if r.get("set_num") == sn), None),
            (int, float),
        )
    ]
    retail_map: Dict[str, float] = {}
    if missing_retail:
        # Deduplicate
        missing_retail = list(dict.fromkeys(missing_retail))
        retail_rows = db.execute(
            select(SetModel.set_num, SetModel.retail_price)
            .where(
                SetModel.set_num.in_(missing_retail),
                SetModel.retail_price.isnot(None),
            )
        ).all()
        for sn, rp in retail_rows:
            if rp is not None:
                retail_map[str(sn)] = float(rp)

    # Build a set of set_nums that have at least one active offer (with a price)
    # so we only show prices on cards that actually lead somewhere purchasable.
    sets_with_offers = set(best_prices.keys())

    for r in rows:
        canonical = r.get("set_num", "")

        # Fill in retail_price if missing
        if not isinstance(r.get("retail_price"), (int, float)):
            if canonical in retail_map:
                r["retail_price"] = retail_map[canonical]

        retail = r.get("retail_price")
        best = best_prices.get(canonical)
        has_offers = canonical in sets_with_offers

        # Only show MSRP as original_price when there are active offers;
        # showing a price with no way to purchase is misleading.
        if isinstance(retail, (int, float)) and retail > 0 and has_offers:
            r["original_price"] = retail

        # Only set sale_price when best offer is strictly less than retail
        if (
            best is not None
            and isinstance(retail, (int, float))
            and retail > 0
            and best < retail
        ):
            r["sale_price"] = best


# ---- Seed data (for initial population) ----

SEED_OFFERS = [
    {"set_num": "10305", "store": "LEGO", "price": 399.99, "currency": "USD", "url": "https://your-affiliate-link-for-lego-10305", "in_stock": True},
    {"set_num": "10305", "store": "Amazon", "price": 379.99, "currency": "USD", "url": "https://your-affiliate-link-for-amazon-10305", "in_stock": True},
    {"set_num": "10497", "store": "LEGO", "price": 99.99, "currency": "USD", "url": "https://example.com/lego-10497", "in_stock": True},
    {"set_num": "10497", "store": "Amazon", "price": 89.99, "currency": "USD", "url": "https://example.com/amazon-10497", "in_stock": False},
    {"set_num": "10497", "store": "Walmart", "price": 94.50, "currency": "USD", "url": "https://example.com/walmart-10497", "in_stock": None},
    {"set_num": "76300", "store": "LEGO", "price": 299.99, "currency": "USD", "url": "https://example.com/lego-76300", "in_stock": True},
    {"set_num": "76300", "store": "Amazon", "price": 279.99, "currency": "USD", "url": "https://example.com/amazon-76300", "in_stock": None},
]


def seed_offers(db: Session) -> int:
    """Insert seed offers if the offers table is empty. Returns count inserted."""
    count = db.execute(select(OfferModel.id).limit(1)).scalar_one_or_none()
    if count is not None:
        return 0  # table already has data

    inserted = 0
    for o in SEED_OFFERS:
        db.add(OfferModel(**o))
        inserted += 1

    db.commit()
    return inserted
