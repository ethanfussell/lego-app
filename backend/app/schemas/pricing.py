# app/schemas/pricing.py
from pydantic import BaseModel


class StoreOffer(BaseModel):
    store: str
    price: float
    currency: str
    url: str
    in_stock: bool