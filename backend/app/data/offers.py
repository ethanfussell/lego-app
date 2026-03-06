from __future__ import annotations

from typing import Any, Dict, List, Optional

from sqlalchemy import select
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
