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

    "10497": [
        {
            "store": "LEGO",
            "price": 99.99,
            "currency": "USD",
            "url": "https://example.com/lego-10497",
            "in_stock": True,
        },
        {
            "store": "Amazon",
            "price": 89.99,
            "currency": "USD",
            "url": "https://example.com/amazon-10497",
            "in_stock": False,
        },
        # “unknown stock” simulation: if your TypedDict forces in_stock,
        # keep it True/False for now and we’ll loosen the typing later.
        # If you already loosened it, you can try: "in_stock": None,
        {
            "store": "Walmart",
            "price": 94.50,
            "currency": "USD",
            "url": "https://example.com/walmart-10497",
            "in_stock": True,
        },
    ],
}


def get_offers_for_set(plain_set_num: str) -> List[StoreOffer]:
    return OFFERS_BY_SET.get(plain_set_num, [])