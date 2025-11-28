# app/schemas/user.py
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel


class PublicListSummary(BaseModel):
    id: int
    title: str
    owner: str
    is_public: bool = True
    count: int
    created_at: datetime
    updated_at: datetime
    description: Optional[str] = None


class UserProfile(BaseModel):
    username: str
    owned_count: int
    wishlist_count: int
    public_lists_count: int
    public_lists: List[PublicListSummary] = []
    