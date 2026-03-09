# app/schemas/email_signup.py
from typing import Optional
from pydantic import BaseModel, EmailStr, Field, field_validator
from app.core.sanitize import sanitize_oneline

class EmailSignupIn(BaseModel):
    email: EmailStr
    source: Optional[str] = Field(default=None, max_length=64)

    @field_validator("source", mode="before")
    @classmethod
    def sanitize_source(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return sanitize_oneline(v) or None

class EmailSignupOut(BaseModel):
    ok: bool = True
    already_subscribed: bool = False