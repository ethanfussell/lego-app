# app/routes/email_signups.py
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.models import EmailSignup
from app.schemas.email_signup import EmailSignupIn, EmailSignupOut

router = APIRouter(tags=["email"])

@router.post("/email-signups", response_model=EmailSignupOut)
def create_email_signup(payload: EmailSignupIn, db: Session = Depends(get_db)):
    email = payload.email.strip().lower()

    existing = db.query(EmailSignup).filter(EmailSignup.email == email).first()
    if existing:
        return EmailSignupOut(ok=True, already_subscribed=True)

    row = EmailSignup(email=email, source=payload.source)
    db.add(row)
    db.commit()
    return EmailSignupOut(ok=True, already_subscribed=False)