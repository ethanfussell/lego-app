# app/schemas/collection.py
from pydantic import BaseModel
from datetime import datetime

class CollectionCreate(BaseModel):
    username: str
    set_num: str

class CollectionItem(BaseModel):
    username: str
    set_num: str
    type: str
    created_at: datetime

    