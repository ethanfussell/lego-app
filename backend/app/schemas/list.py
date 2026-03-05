# backend/app/schemas/list.py
from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.core.sanitize import sanitize_oneline, sanitize_text


class ListCreate(BaseModel):
    title: str = Field(..., max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    is_public: bool = True

    @field_validator("title")
    @classmethod
    def sanitize_title(cls, value: str) -> str:
        return sanitize_oneline(value)

    @field_validator("description")
    @classmethod
    def sanitize_description(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return sanitize_text(value)


class ListItemsOrderUpdate(BaseModel):
    set_nums: List[str]


class ListItemCreate(BaseModel):
    set_num: str


class ListOrderUpdate(BaseModel):
    ordered_ids: List[int]


class ListSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    is_public: bool = True
    owner: str
    items_count: int
    position: int = 0
    is_system: bool = False
    system_key: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class ListItemOut(BaseModel):
    """
    Returned inside ListDetail.items
    """
    set_num: str
    added_at: Optional[datetime] = None
    position: Optional[int] = None


class ListDetail(ListSummary):
    items: List[ListItemOut] = Field(default_factory=list)


class ListUpdate(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = Field(default=None, max_length=2000)
    is_public: Optional[bool] = None

    @field_validator("title")
    @classmethod
    def sanitize_title(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return sanitize_oneline(value)

    @field_validator("description")
    @classmethod
    def sanitize_description(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return sanitize_text(value)
