# app/schemas/review.py
from pydantic import BaseModel, conint
from typing import Optional
from datetime import datetime

class Review(BaseModel):
    id: int
    set_num: str
    rating: conint(ge=1, le=5)
    text: Optional[str] = None
    user: str = "anonymous"
    created_at: datetime

class ReviewCreate(BaseModel):
    rating: conint(ge=1, le=5)
    text: Optional[str] = None
    user: str = "anonymous"