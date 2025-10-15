# app/schemas/review.py
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime

class Review(BaseModel):
    id: int
    set_num: str
    rating: int = Field(ge=1, le=5)
    text: str
    user: str
    created_at: datetime
    likes_count: int = 0
    liked_by: List[str] = Field(default_factory=list)  # use factory instead of []

class ReviewCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str
    user: str  # temporary until we add real auth

class ReviewUpdate(BaseModel):
    # IMPORTANT: give Optional fields an explicit default=None when using validators
    rating: Optional[int] = Field(default=None, ge=1, le=5)
    text: Optional[str] = None
    user: str  # the actor performing update (must match author for now)

class ActorPayload(BaseModel):
    user: str