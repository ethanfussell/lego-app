# backend/app/schemas/theme.py
from pydantic import BaseModel


class ThemeSummary(BaseModel):
    slug: str
    name: str
    set_count: int