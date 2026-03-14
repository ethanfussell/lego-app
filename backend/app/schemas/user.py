# app/schemas/user.py
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


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


class UserProfileRead(BaseModel):
    """Returned by /users/me and /users/{username}."""
    id: int
    username: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    location: Optional[str] = None
    created_at: datetime


class UserProfileUpdate(BaseModel):
    """PATCH /users/me/profile — all fields optional."""
    display_name: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = Field(None, max_length=500)
    avatar_url: Optional[str] = Field(None, max_length=2000)
    location: Optional[str] = Field(None, max_length=100)
