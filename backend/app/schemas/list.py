# backend/app/schemas/list.py
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class ListCreate(BaseModel):
    title: str
    description: Optional[str] = None
    is_public: bool = True


class ListItemCreate(BaseModel):
    set_num: str


class ListOrderUpdate(BaseModel):
    ordered_ids: List[int]


class ListDetail(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    is_public: bool = True
    owner: str
    items: List[str] = Field(default_factory=list)
    items_count: int
    position: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ListUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None