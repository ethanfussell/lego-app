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
from app.models import User  # adjust if needed

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


# ---------------- settings (read from env at runtime) ----------------

def _settings():
    secret_key = (os.getenv("SECRET_KEY") or "").strip()
    algorithm = (os.getenv("JWT_ALGORITHM") or "HS256").strip()
    expire_minutes = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES") or "60")
    allow_fake = (os.getenv("ALLOW_FAKE_AUTH") or "").lower() in ("1", "true", "yes", "on")
    return secret_key, algorithm, expire_minutes, allow_fake


def _unauth(detail: str = "Invalid token") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _require_secret_key():
    secret_key, _, _, allow_fake = _settings()
    if secret_key or allow_fake:
        return
    raise RuntimeError("SECRET_KEY is not set (and ALLOW_FAKE_AUTH is not enabled).")


# ---------------- schemas ----------------

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ---------------- token helpers ----------------

def create_access_token(username: str) -> str:
    username = (username or "").strip()
    if not username:
        raise ValueError("username required for token")

    # Dev-only escape hatch:
    if ALLOW_FAKE_AUTH and not SECRET_KEY:
        return f"fake-token-for-{username}"

    _require_secret_key()

    now_ts = int(datetime.now(timezone.utc).timestamp())
    exp_ts = now_ts + (ACCESS_TOKEN_EXPIRE_MINUTES * 60)

    payload = {
        "sub": username,
        "iat": now_ts,
        "exp": exp_ts,  # ✅ MUST be int seconds
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def _username_from_token(token: str) -> Optional[str]:
    token = (token or "").strip()
    if not token:
        return None

    if ALLOW_FAKE_AUTH and token.startswith("fake-token-for-"):
        return token.replace("fake-token-for-", "", 1).strip() or None

    _require_secret_key()

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        return str(sub).strip() if sub else None
    except JWTError:
        return None


# ---------------- deps ----------------

def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    username = _username_from_token(token)
    if not username:
        raise _unauth("Invalid token")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise _unauth("Invalid token")

    return user


def get_current_user_optional(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme_optional),
) -> Optional[User]:
    if not token:
        return None
    username = _username_from_token(token)
    if not username:
        return None
    return db.query(User).filter(User.username == username).first()


# ---------------- routes ----------------

@router.post("/auth/login", response_model=Token)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    username = (form.username or "").strip()
    password = (form.password or "").strip()

    # Minimal auth (replace with real password verification later)
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # If you have password_hash, verify here. For now assume valid in dev.
    # Example:
    # if getattr(user, "password_hash", None):
    #     if not verify_password(password, user.password_hash):
    #         raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_access_token(user.username)
    return Token(access_token=token)