# backend/app/core/auth.py
from __future__ import annotations

import hashlib
import os
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


def _settings():
    secret = (os.getenv("SECRET_KEY") or "").strip()
    alg = (os.getenv("JWT_ALGORITHM") or "HS256").strip()
    exp_min = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES") or "60")
    allow_fake = (os.getenv("ALLOW_FAKE_AUTH") or "").lower() in ("1", "true", "yes", "on")
    debug = (os.getenv("AUTH_DEBUG") or "").lower() in ("1", "true", "yes", "on")
    kid = hashlib.sha256(secret.encode("utf-8")).hexdigest()[:8] if secret else "none"
    return secret, alg, exp_min, allow_fake, debug, kid


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


def _unauth(detail: str = "Invalid token") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def create_access_token(username: str) -> str:
    username = (username or "").strip()
    if not username:
        raise ValueError("username required for token")

    secret, alg, exp_min, allow_fake, debug, kid = _settings()

    if allow_fake and not secret:
        return f"fake-token-for-{username}"

    if not secret:
        raise RuntimeError("SECRET_KEY is not set (and ALLOW_FAKE_AUTH is not enabled).")

    now_ts = int(time.time())
    exp_ts = now_ts + exp_min * 60

    payload = {"sub": username, "iat": now_ts, "exp": exp_ts}
    tok = jwt.encode(payload, secret, algorithm=alg)

    if debug:
        print(f"[auth] minted token sub={username} alg={alg} kid={kid} iat={now_ts} exp={exp_ts}")

    return tok


def _username_from_token(token: str) -> Optional[str]:
    token = (token or "").strip()
    if not token:
        return None

    secret, alg, _exp_min, allow_fake, debug, kid = _settings()

    if allow_fake and token.startswith("fake-token-for-"):
        return token.replace("fake-token-for-", "", 1).strip() or None

    if not secret:
        return None

    if debug:
        try:
            hdr = jwt.get_unverified_header(token)
            claims = jwt.get_unverified_claims(token)
            print(f"[auth] verify token kid={kid} env_alg={alg} hdr_alg={hdr.get('alg')} sub={claims.get('sub')} iat={claims.get('iat')} exp={claims.get('exp')}")
        except Exception as e:
            print(f"[auth] could not parse token header/claims kid={kid} err={repr(e)}")

    try:
        payload = jwt.decode(token, secret, algorithms=[alg])
        sub = payload.get("sub")
        return str(sub).strip() if sub else None
    except JWTError as e:
        if debug:
            print(f"[auth] JWT decode failed kid={kid} alg={alg} err={repr(e)}")
        return None


def get_current_user(db: Session = Depends(get_db), token: str = Depends(oauth2_scheme)) -> User:
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


@router.post("/auth/login", response_model=Token)
async def login(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    username = (form.username or "").strip()
    _password = (form.password or "").strip()

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    return Token(access_token=create_access_token(user.username))