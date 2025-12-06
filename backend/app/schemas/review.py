# backend/app/schemas/review.py
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, validator, root_validator


class ActorPayload(BaseModel):
    """
    Simple payload for actions that need to know "who" is acting
    (e.g. delete review, like/unlike).
    """
    user: str


class Review(BaseModel):
    id: int
    set_num: str
    user: str
    rating: Optional[float] = None  # 0.5–5.0 in 0.5 steps OR None
    text: Optional[str] = None
    created_at: datetime
    likes_count: int = 0
    liked_by: List[str] = []

    class Config:
        orm_mode = True


class ReviewCreate(BaseModel):
    # user is now optional; frontend doesn't HAVE to send it
    user: Optional[str] = None
    rating: Optional[float] = None   # can be rating-only, text-only, or both
    text: Optional[str] = None

    @validator("rating")
    def validate_rating(cls, v: Optional[float]) -> Optional[float]:
        # Allow missing rating (text-only review)
        if v is None:
            return v

        # Range: 0.5–5.0
        if v < 0.5 or v > 5.0:
            raise ValueError("Rating must be between 0.5 and 5.0")

        # Must be in 0.5 increments
        if abs(v * 2 - round(v * 2)) > 1e-6:
            raise ValueError("Rating must be in 0.5 increments (0.5, 1.0, 1.5, ..., 5.0)")

        return float(v)

    @validator("text")
    def normalize_text(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        stripped = v.strip()
        return stripped or None

    @root_validator(skip_on_failure=True)
    def require_rating_or_text(cls, values):
        rating = values.get("rating")
        text = values.get("text")

        if rating is None and (text is None or not text.strip()):
            raise ValueError("You must provide a rating, review text, or both.")
        return values


class ReviewUpdate(BaseModel):
    user: str
    rating: Optional[float] = None
    text: Optional[str] = None

    @validator("rating")
    def validate_rating(cls, v: Optional[float]) -> Optional[float]:
        if v is None:
            return v
        if v < 0.5 or v > 5.0:
            raise ValueError("Rating must be between 0.5 and 5.0")
        if abs(v * 2 - round(v * 2)) > 1e-6:
            raise ValueError("Rating must be in 0.5 increments (0.5, 1.0, 1.5, ..., 5.0)")
        return float(v)

    @validator("text")
    def normalize_text(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        stripped = v.strip()
        return stripped or None


class RatingSummary(BaseModel):
    """
    Aggregate rating info for a set.
    - average: average rating across reviews with a rating, rounded to 1 decimal
    - count: how many reviews actually have a rating
    """
    set_num: str
    average: Optional[float] = None  # e.g. 4.3, or None if no ratings
    count: int