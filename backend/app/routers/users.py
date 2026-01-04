# backend/app/routers/users.py
from __future__ import annotations

from typing import Any, Dict, List as TypingList

from fastapi import APIRouter, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import User as UserModel
from ..models import List as ListModel
from ..models import ListItem as ListItemModel

router = APIRouter(prefix="/users")


def _items_count_expr():
    return (
        select(func.count(ListItemModel.set_num))
        .where(ListItemModel.list_id == ListModel.id)
        .correlate(ListModel)
        .scalar_subquery()
    )


@router.get("/{username}")
def get_user(username: str):
    # lightweight “public profile” endpoint
    # (not used much yet, but safe)
    with next(get_db()) as db:  # simple use; keeps your existing get_db generator
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
            .order_by(ListModel.position.asc(), ListModel.id.asc())
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