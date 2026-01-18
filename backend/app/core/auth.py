# backend/app/core/auth.py
from __future__ import annotations

import bcrypt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User as UserModel

router = APIRouter()

# ----------------- Response Models -----------------
class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str | None = None  # dev-only for now


# ----------------- Dev-only "fake password" map -----------------
FAKE_USERS_DB = {
    "ethan": {"password": "lego123", "full_name": "Ethan Fussell"},
    # add more fake creds if you want
}

# OAuth2PasswordBearer reads the Authorization: Bearer <token> header
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)

TOKEN_PREFIX = "fake-token-for-"


def create_access_token(username: str) -> str:
    return f"{TOKEN_PREFIX}{username}"


def _username_from_token(token: str) -> str:
    token = (token or "").strip()
    if token.startswith(TOKEN_PREFIX):
        return token[len(TOKEN_PREFIX) :].strip()
    return token


def _get_user_by_username(db: Session, username: str) -> UserModel | None:
    if not username:
        return None
    return db.execute(
        select(UserModel).where(UserModel.username == username).limit(1)
    ).scalar_one_or_none()


@router.post("/auth/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    username_raw = (form_data.username or "").strip()
    password = form_data.password or ""

    if not username_raw:
        raise HTTPException(status_code=400, detail="Missing username")

    username_key = username_raw.lower()  # ✅ normalize for FAKE_USERS_DB
    expected = FAKE_USERS_DB.get(username_key)

    # 1) Dev-only fake users (ethan) — auto-create in DB if missing
    if expected is not None:
        if password != expected["password"]:
            raise HTTPException(status_code=400, detail="Incorrect username or password")

        db_user = _get_user_by_username(db, username_key)
        if db_user is None:
            db_user = UserModel(username=username_key, password_hash="")
            db.add(db_user)
            db.commit()
            db.refresh(db_user)

        return Token(access_token=create_access_token(username_key))

    # 2) Real DB-backed users must exist
    db_user = _get_user_by_username(db, username_raw)
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"User '{username_raw}' not found in DB. Seed/create it first.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    stored = (db_user.password_hash or "").encode("utf-8")
    ok = bcrypt.checkpw(password.encode("utf-8"), stored)
    if not ok:
        raise HTTPException(status_code=400, detail="Incorrect username or password")

    return Token(access_token=create_access_token(db_user.username))


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> UserModel:
    username = _username_from_token(token)
    db_user = _get_user_by_username(db, username)

    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return db_user


async def get_current_user_optional(
    token: str | None = Depends(oauth2_scheme_optional),
    db: Session = Depends(get_db),
) -> UserModel | None:
    # NEVER raise here. This is for “optional auth” routes.
    if not token:
        return None

    username = _username_from_token(token)
    db_user = _get_user_by_username(db, username)

    # If token is junk or user doesn't exist, treat as anonymous.
    return db_user


@router.get("/auth/me", response_model=UserOut)
async def read_me(current_user: UserModel = Depends(get_current_user)) -> UserOut:
    dev = FAKE_USERS_DB.get(current_user.username) or {}
    return UserOut(
        id=int(current_user.id),
        username=current_user.username,
        full_name=dev.get("full_name"),
    )