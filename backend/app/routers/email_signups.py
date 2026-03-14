# app/routes/email_signups.py
from fastapi import APIRouter, Body, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.limiter import limiter
from app.db import get_db
from app.models import EmailSignup
from app.schemas.email_signup import EmailSignupIn, EmailSignupOut

router = APIRouter(tags=["email"])

@router.post("/email-signups", response_model=EmailSignupOut)
@limiter.limit("5/minute")
def create_email_signup(request: Request, payload: EmailSignupIn = Body(...), db: Session = Depends(get_db)):
    email = payload.email.strip().lower()

    existing = db.execute(select(EmailSignup).where(EmailSignup.email == email)).scalar_one_or_none()
    if existing:
        return EmailSignupOut(ok=True, already_subscribed=True)

    row = EmailSignup(email=email, source=payload.source)
    db.add(row)
    db.commit()
    return EmailSignupOut(ok=True, already_subscribed=False)