# backend/app/routers/users.py
from __future__ import annotations

from typing import Any, Dict, List as TypingList, Optional, Annotated

from fastapi import APIRouter, HTTPException, Header
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User as UserModel
from ..models import List as ListModel
from ..models import ListItem as ListItemModel

router = APIRouter(prefix="/users", tags=["users"])

def _items_count_expr():
    return (
        select(func.count(ListItemModel.set_num))
        .where(ListItemModel.list_id == ListModel.id)
        .correlate(ListModel)
        .scalar_subquery()
    )


@router.get("/me")
def me(authorization: Annotated[Optional[str], Header()] = None):
    """
    Return the current user from the fake bearer token.
    Expected token format: "fake-token-for-<username>"
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing token")

    token = authorization.split(" ", 1)[1]
    prefix = "fake-token-for-"
    if not token.startswith(prefix):
        raise HTTPException(status_code=401, detail="Invalid token")

    username = token[len(prefix) :]
    return {"username": username}


@router.get("")
def list_users(limit: int = 20):
    with next(get_db()) as db:
        rows = db.execute(select(UserModel.username).limit(limit)).scalars().all()
        return rows


@router.get("/{username}")
def get_user(username: str):
    # lightweight “public profile” endpoint
    with next(get_db()) as db:
        user = db.execute(
            select(UserModel).where(UserModel.username == username).limit(1)
        ).scalar_one_or_none()

        if not user:
            raise HTTPException(status_code=404, detail="user_not_found")

        return {"id": int(user.id), "username": user.username}


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