# backend/app/schemas/affiliate.py
from typing import Optional
from pydantic import BaseModel, Field

class AffiliateClickIn(BaseModel):
    set_num: str = Field(..., min_length=1)
    store: str = Field(..., min_length=1)
    price: Optional[float] = None
    currency: Optional[str] = None
    offer_rank: Optional[int] = None
    page_path: str = Field(..., min_length=1)