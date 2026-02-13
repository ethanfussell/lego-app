from typing import Optional
from pydantic import BaseModel, Field

class SetBulkOut(BaseModel):
    set_num: str = Field(
        ...,
        description="Canonical set number",
        json_schema_extra={"example": "10305-1"},
    )
    name: Optional[str] = Field(None, json_schema_extra={"example": "Lion Knights' Castle"})
    year: Optional[int] = Field(None, json_schema_extra={"example": 2022})
    theme: Optional[str] = Field(None, json_schema_extra={"example": "Castle"})
    pieces: Optional[int] = Field(None, json_schema_extra={"example": 4514})
    image_url: Optional[str] = Field(None, json_schema_extra={"example": "https://..."})
    price_from: Optional[float] = Field(None, json_schema_extra={"example": 299.99})

    average_rating: Optional[float] = Field(None, json_schema_extra={"example": 4.62})
    rating_avg: Optional[float] = Field(None, json_schema_extra={"example": 4.62})
    rating_count: int = Field(0, json_schema_extra={"example": 18})

    user_rating: Optional[float] = Field(None, json_schema_extra={"example": 4.5})