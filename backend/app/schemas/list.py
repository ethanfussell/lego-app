from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict, Field


class ListCreate(BaseModel):
    title: str
    description: Optional[str] = None
    is_public: bool = True


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


class ListDetail(ListSummary):
    items: List[str] = Field(default_factory=list)


class ListUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None