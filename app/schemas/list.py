# app/schemas/list.py
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime

class ListItemCreate(BaseModel):
    set_num: str
    note: Optional[str] = None
    position: Optional[int] = None  # if None, append to end

class ListItem(BaseModel):
    set_num: str
    note: Optional[str] = None
    position: int
    added_at: datetime

class ListCreate(BaseModel):
    owner: str
    name: str
    description: Optional[str] = None
    is_public: bool = True

class ListUpdate(BaseModel):
    user: str  # actor (must be owner)
    name: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None

class ListSummary(BaseModel):
    id: int
    owner: str
    name: str
    description: Optional[str] = None
    is_public: bool
    created_at: datetime
    updated_at: datetime
    items_count: int

class UserList(BaseModel):
    id: int
    owner: str
    name: str
    description: Optional[str] = None
    is_public: bool
    created_at: datetime
    updated_at: datetime
    items: List[ListItem]

class ReorderPayload(BaseModel):
    user: str              # actor (must be owner)
    set_nums: List[str]    # new order (must contain exactly the same set_nums)

class ActorPayload(BaseModel):
    user: str  # actor (must be owner)