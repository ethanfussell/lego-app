# backend/app/routers/users.py
from __future__ import annotations

from typing import Any, Dict, List as TypingList

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.sanitize import sanitize_oneline, sanitize_text
from app.db import get_db
from app.models import User as UserModel
from app.models import List as ListModel
from app.models import ListItem as ListItemModel
from app.models import Follower
from app.schemas.user import UserProfileRead, UserProfileUpdate

router = APIRouter(prefix="/users", tags=["users"])


def _items_count_expr():
    return (
        select(func.count(ListItemModel.set_num))
        .where(ListItemModel.list_id == ListModel.id)
        .correlate(ListModel)
        .scalar_subquery()
    )


def _follow_counts(db: Session, user_id: int) -> tuple[int, int]:
    followers = db.execute(
        select(func.count()).select_from(Follower).where(Follower.following_id == user_id)
    ).scalar() or 0
    following = db.execute(
        select(func.count()).select_from(Follower).where(Follower.follower_id == user_id)
    ).scalar() or 0
    return followers, following


def _user_to_profile_read(user: UserModel, db: Session | None = None) -> dict[str, Any]:
    data: dict[str, Any] = {
        "id": int(user.id),
        "username": user.username,
        "display_name": user.display_name,
        "bio": user.bio,
        "avatar_url": user.avatar_url,
        "location": user.location,
        "created_at": user.created_at,
    }
    if db is not None:
        fc, fg = _follow_counts(db, user.id)
        data["followers_count"] = fc
        data["following_count"] = fg
    return data


@router.get("/me")
def me(user: UserModel = Depends(get_current_user), db: Session = Depends(get_db)):
    return _user_to_profile_read(user, db)


@router.patch("/me/profile", response_model=UserProfileRead)
def update_my_profile(
    payload: UserProfileUpdate,
    user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's profile fields."""
    updates = payload.model_dump(exclude_unset=True)

    if "display_name" in updates:
        v = updates["display_name"]
        user.display_name = sanitize_oneline(v) if v else None

    if "bio" in updates:
        v = updates["bio"]
        user.bio = sanitize_text(v) if v else None

    if "avatar_url" in updates:
        user.avatar_url = updates["avatar_url"] or None

    if "location" in updates:
        v = updates["location"]
        user.location = sanitize_oneline(v) if v else None

    db.add(user)
    db.commit()
    db.refresh(user)

    return _user_to_profile_read(user, db)


@router.get("")
def list_users(limit: int = 20):
    with next(get_db()) as db:
        rows = db.execute(select(UserModel.username).limit(limit)).scalars().all()
        return rows


@router.get("/{username}")
def get_user(username: str, db: Session = Depends(get_db)):
    user = db.execute(
        select(UserModel).where(UserModel.username == username).limit(1)
    ).scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="user_not_found")

    return _user_to_profile_read(user, db)


@router.get("/{username}/lists")
def get_user_public_lists(username: str) -> TypingList[Dict[str, Any]]:
    """
    Public lists for a user (Explore can use this later).
    """
    with next(get_db()) as db:
        user = db.execute(
            select(UserModel).where(UserModel.username == username).limit(1)
        ).scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="user_not_found")

        items_count = _items_count_expr()

        rows = db.execute(
            select(ListModel, items_count.label("items_count"))
            .where(ListModel.owner_id == user.id, ListModel.is_public.is_(True))
            .order_by(
                func.coalesce(ListModel.updated_at, ListModel.created_at).desc(),
                ListModel.id.desc(),
            )
        ).all()

        out: TypingList[Dict[str, Any]] = []
        for (lst, count) in rows:
            out.append(
                {
                    "id": int(lst.id),
                    "title": lst.title,
                    "description": lst.description,
                    "is_public": bool(lst.is_public),
                    "owner": username,
                    "items_count": int(count),
                    "position": int(lst.position or 0),
                    "is_system": bool(lst.is_system),
                    "system_key": lst.system_key,
                    "created_at": lst.created_at,
                    "updated_at": lst.updated_at,
                }
            )
        return out
