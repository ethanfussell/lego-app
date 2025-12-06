# app/schemas/review.py
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, validator


class ActorPayload(BaseModel):
    """
    Simple payload for actions that need to know "who" is acting
    (e.g. delete review, like/unlike).
    """
    user: str


class Review(BaseModel):
    id: int
    set_num: str
    user: str                         # ✅ must always be a string
    rating: Optional[float] = None    # 0.5–5.0 in 0.5 steps OR None
    text: Optional[str] = None
    created_at: datetime
    likes_count: int = 0
    liked_by: List[str] = []

    class Config:
        orm_mode = True


class ReviewCreate(BaseModel):
    # 👇 the client (React) only sends these
    rating: Optional[float] = None   # can be rating-only, text-only, or both
    text: Optional[str] = None

    @validator("rating")
    def validate_rating(cls, value: Optional[float]):
        """
        Allow None, otherwise require 0.5–5.0 in 0.5 steps.
        """
        if value is None:
            return value

        if value < 0.5 or value > 5.0:
            raise ValueError("Rating must be between 0.5 and 5.0")

        # enforce 0.5 steps: multiply by 2 → should be an integer
        if (value * 2) % 1 != 0:
            raise ValueError("Rating must be in increments of 0.5")

        return value