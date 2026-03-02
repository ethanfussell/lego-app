from __future__ import annotations

from typing import Dict, List, Optional, TypedDict


class StoreOffer(TypedDict):
    store: str
    price: float
    currency: str
    url: str
    in_stock: Optional[bool]  # True / False / None (unknown)
    updated_at: str  # ISO string, e.g. "2026-03-01T18:45:00Z"


OFFERS_BY_SET: Dict[str, List[StoreOffer]] = {
    "10305": [
        {
            "store": "LEGO",
            "price": 399.99,
            "currency": "USD",
            "url": "https://your-affiliate-link-for-lego-10305",
            "in_stock": True,
            "updated_at": "2026-03-01T18:00:00Z",
        },
        {
            "store": "Amazon",
            "price": 379.99,
            "currency": "USD",
            "url": "https://your-affiliate-link-for-amazon-10305",
            "in_stock": True,
            "updated_at": "2026-03-01T18:10:00Z",
        },
    ],
    "10497": [
        {
            "store": "LEGO",
            "price": 99.99,
            "currency": "USD",
            "url": "https://example.com/lego-10497",
            "in_stock": True,
            "updated_at": "2026-03-01T18:00:00Z",
        },
        {
            "store": "Amazon",
            "price": 89.99,
            "currency": "USD",
            "url": "https://example.com/amazon-10497",
            "in_stock": False,
            "updated_at": "2026-03-01T18:05:00Z",
        },
        {
            "store": "Walmart",
            "price": 94.50,
            "currency": "USD",
            "url": "https://example.com/walmart-10497",
            "in_stock": None,  # unknown
            "updated_at": "2026-03-01T18:07:00Z",
        },
    ],
    "76300": [
        {
            "store": "LEGO",
            "price": 299.99,
            "currency": "USD",
            "url": "https://example.com/lego-76300",
            "in_stock": True,
            "updated_at": "2026-03-01T18:00:00Z",
        },
        {
            "store": "Amazon",
            "price": 279.99,
            "currency": "USD",
            "url": "https://example.com/amazon-76300",
            "in_stock": None,  # unknown
            "updated_at": "2026-03-01T18:03:00Z",
        },
    ],
}


def _normalize_plain_set_num(v: str) -> str:
    # accept "76300", "76300-1", " 76300-1 "
    s = (v or "").strip()
    if not s:
        return ""
    return s.split("-")[0]


def get_offers_for_set(plain_set_num: str) -> List[StoreOffer]:
    key = _normalize_plain_set_num(plain_set_num)
    offers = list(OFFERS_BY_SET.get(key, []))

    # sort: in-stock first, then unknown, then out-of-stock; then cheapest
    def stock_rank(x: StoreOffer) -> int:
        v = x.get("in_stock")
        if v is True:
            return 0
        if v is None:
            return 1
        return 2

    offers.sort(key=lambda o: (stock_rank(o), float(o.get("price") or 0.0)))
    return offers