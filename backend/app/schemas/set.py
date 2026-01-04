from typing import Optional
from pydantic import BaseModel, Field

class SetBulkOut(BaseModel):
    set_num: str = Field(..., example="10305-1", description="Canonical set number")
    name: Optional[str] = Field(None, example="Lion Knights' Castle")
    year: Optional[int] = Field(None, example=2022)
    theme: Optional[str] = Field(None, example="Castle")
    pieces: Optional[int] = Field(None, example=4514)
    image_url: Optional[str] = Field(None, example="https://...")
    price_from: Optional[float] = Field(None, example=299.99)

    average_rating: Optional[float] = Field(None, example=4.62)
    rating_avg: Optional[float] = Field(None, example=4.62)
    rating_count: int = Field(0, example=18)

    user_rating: Optional[float] = Field(None, example=4.5)