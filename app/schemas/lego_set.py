from pydantic import BaseModel
from typing import Optional

class LegoSet(BaseModel):
    set_num: str
    name: str
    pieces: Optional[int] = None
    theme: Optional[str] = None
    year: Optional[int] = None

class LegoSetCreate(BaseModel):
    set_num: str
    name: str
    pieces: Optional[int] = None
    theme: Optional[str] = None
    year: Optional[int] = None