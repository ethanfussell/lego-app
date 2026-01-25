from typing import Dict, List, TypedDict


class StoreOffer(TypedDict):
    store: str
    price: float
    currency: str
    url: str
    in_stock: bool


OFFERS_BY_SET: Dict[str, List[StoreOffer]] = {
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
}


def get_offers_for_set(plain_set_num: str) -> List[StoreOffer]:
    return OFFERS_BY_SET.get(plain_set_num, [])