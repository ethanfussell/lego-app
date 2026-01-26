# backend/app/core/auth.py
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User  # adjust import if your User model lives elsewhere


router = APIRouter()

# ---------------- config ----------------

SECRET_KEY = (os.getenv("SECRET_KEY") or "").strip()
ALGORITHM = (os.getenv("JWT_ALGORITHM") or "HS256").strip()
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES") or "60")

# Allow fake tokens ONLY when explicitly enabled (local/dev)
ALLOW_FAKE_AUTH = (os.getenv("ALLOW_FAKE_AUTH") or "").lower() in ("1", "true", "yes", "on")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

# ---------------- schemas ----------------

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

# ---------------- helpers ----------------

def _require_secret_key():
    """
    In staging/prod you MUST set SECRET_KEY.
    If you want to run locally without JWT, set ALLOW_FAKE_AUTH=true.
    """
    if SECRET_KEY:
        return
    if ALLOW_FAKE_AUTH:
        return
    raise RuntimeError("SECRET_KEY is not set (and ALLOW_FAKE_AUTH is not enabled).")

def create_access_token(username: str) -> str:
    username = (username or "").strip()
    if not username:
        raise ValueError("username required for token")

    # Dev-only escape hatch:
    if ALLOW_FAKE_AUTH and not SECRET_KEY:
        return f"fake-token-for-{username}"

    _require_secret_key()

    now = datetime.now(timezone.utc)
    exp = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    payload = {
        "sub": username,
        "iat": int(now.timestamp()),
        "exp": exp,
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def _username_from_token(token: str) -> Optional[str]:
    token = (token or "").strip()
    if not token:
        return None

    # Accept fake tokens only when enabled
    if ALLOW_FAKE_AUTH and token.startswith("fake-token-for-"):
        return token.replace("fake-token-for-", "", 1).strip() or None

    _require_secret_key()

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        return str(sub).strip() if sub else None
    except JWTError:
        return None

def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
    username = _username_from_token(token)
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user

def get_current_user_optional(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme_optional)) -> Optional[User]:
    if not token:
        return None
    username = _username_from_token(token)
    if not username:
        return None
    return db.query(User).filter(User.username == username).first()

# ---------------- routes ----------------

@router.post("/auth/login", response_model=Token)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    username = (form.username or "").strip()
    password = (form.password or "").strip()

    # TODO: replace with your real password verification if you have it.
    # Minimal pattern:
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # If your User has password_hash, verify it here. Otherwise keep your existing logic.
    # Example placeholder:
    if getattr(user, "password_hash", None):
        # replace with your verify_password()
        pass

    token = create_access_token(user.username)
    return Token(access_token=token)