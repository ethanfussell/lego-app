from typing import Dict, List, TypedDict


class StoreOffer(TypedDict):
    store: str       # "LEGO", "Amazon", "Target", etc.
    price: float     # 399.99
    currency: str    # "USD"
    url: str         # your affiliate link
    in_stock: bool   # True/False


# Keyed by *plain* set number, e.g. "10305"
OFFERS_BY_SET: Dict[str, List[StoreOffer]] = {
    # Example; you can fill this out manually for now
    "10305": [
        {
            "store": "LEGO",
            "price": 399.99,
            "currency": "USD",
            "url": "https://your-affiliate-link-for-lego-10305",
            "in_stock": True,
        },
        {
            "store": "Amazon",
            "price": 379.99,
            "currency": "USD",
            "url": "https://your-affiliate-link-for-amazon-10305",
            "in_stock": True,
        },
    ],
    # "21330": [...],
}


def get_offers_for_set(plain_set_num: str) -> List[StoreOffer]:
    """Return all offers for a given plain set number like '10305'."""
    return OFFERS_BY_SET.get(plain_set_num, [])