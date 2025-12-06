from typing import Optional
from pydantic import BaseModel
from datetime import datetime

class CollectionCreate(BaseModel):
    # username is optional & ignored; we use the token instead
    set_num: str
    username: Optional[str] = None

class CollectionItem(BaseModel):
    username: str
    set_num: str
    type: str
    created_at: datetime