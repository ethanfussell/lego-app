# app/schemas/email_signup.py
from pydantic import BaseModel, EmailStr, Field

class EmailSignupIn(BaseModel):
    email: EmailStr
    source: str | None = Field(default=None, max_length=64)

class EmailSignupOut(BaseModel):
    ok: bool = True
    already_subscribed: bool = False