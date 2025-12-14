# backend/app/core/auth.py
from __future__ import annotations

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
    # Pydantic v2: replacement for orm_mode
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    full_name: str | None = None  # not stored in DB (yet)


# ----------------- Dev-only "fake password" map -----------------
# This is ONLY used to validate the password during login.
# The user must still exist in the real DB so we can return current_user.id.
FAKE_USERS_DB = {
    "ethan": {
        "password": "lego123",
        "full_name": "Ethan Fussell",
    }
}

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def create_access_token(username: str) -> str:
    # dev-only token format
    return f"fake-token-for-{username}"


def _username_from_token(token: str) -> str:
    if token.startswith("fake-token-for-"):
        return token.removeprefix("fake-token-for-")
    return token


def _get_user_by_username(db: Session, username: str) -> UserModel | None:
    return db.execute(
        select(UserModel).where(UserModel.username == username).limit(1)
    ).scalar_one_or_none()


@router.post("/auth/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
) -> Token:
    username = (form_data.username or "").strip()
    password = form_data.password or ""

    if not username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing username",
        )

    # 1) Dev password check (frontend default creds)
    expected = FAKE_USERS_DB.get(username)
    if expected is None or password != expected["password"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect username or password",
        )

    # 2) Must exist in DB so routes can use current_user.id
    db_user = _get_user_by_username(db, username)
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"User '{username}' not found in DB. Seed/create it first.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return Token(access_token=create_access_token(username))


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> UserModel:
    username = _username_from_token(token)

    db_user = _get_user_by_username(db, username)
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token/user",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return db_user


@router.get("/auth/me", response_model=UserOut)
async def read_me(current_user: UserModel = Depends(get_current_user)) -> UserOut:
    # full_name is dev-only (not in DB yet)
    dev = FAKE_USERS_DB.get(current_user.username) or {}
    return UserOut(
        id=int(current_user.id),
        username=current_user.username,
        full_name=dev.get("full_name"),
    )