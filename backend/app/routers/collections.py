# backend/app/routers/collections.py
from __future__ import annotations

from typing import Any, Dict, List as TypingList, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Response
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.auth import get_current_user
from ..db import get_db
from ..models import List as ListModel
from ..models import ListItem as ListItemModel
from ..models import Set as SetModel
from ..models import User as UserModel

router = APIRouter()


class CollectionOrderUpdate(BaseModel):
    set_nums: TypingList[str] = Field(default_factory=list)


# ---------- shared helpers ----------
def _resolve_set_num(db: Session, set_num_or_plain: str) -> str:
    """
    Accepts '10305' or '10305-1' and returns canonical set_num in DB ('10305-1').
    """
    raw = (set_num_or_plain or "").strip()
    if not raw:
        raise HTTPException(status_code=422, detail="set_num_required")

    plain = raw.split("-")[0].lower()
    plain_expr = func.split_part(SetModel.set_num, "-", 1)

    canonical = db.execute(
        select(SetModel.set_num)
        .where(func.lower(SetModel.set_num) == raw.lower())
        .limit(1)
    ).scalar_one_or_none()

    if not canonical:
        canonical = db.execute(
            select(SetModel.set_num)
            .where(func.lower(plain_expr) == plain)
            .limit(1)
        ).scalar_one_or_none()

    if not canonical:
        raise HTTPException(status_code=404, detail="set_not_found")

    return canonical


def _candidate_set_nums_for_delete(raw: str) -> TypingList[str]:
    """
    For idempotent DELETE:
    - If user passes "10026", we try ["10026-1", "10026"] (in case old data exists).
    - If user passes "10026-1", we try ["10026-1"].
    - No DB lookup, so unknown sets won't 404.
    """
    s = (raw or "").strip()
    if not s:
        return []
    if "-" in s:
        return [s]
    return [f"{s}-1", s]


def _set_to_dict(s: SetModel) -> Dict[str, Any]:
    return {
        "set_num": s.set_num,
        "name": s.name,
        "year": s.year,
        "theme": s.theme,
        "pieces": s.pieces,
        "image_url": s.image_url,
        "created_at": s.created_at,
    }


def _get_or_create_system_list(db: Session, user_id: int, key: str) -> ListModel:
    """
    Owned/Wishlist are system lists stored in lists/list_items.
    If missing (e.g., older DB or new user without seeding), create them.
    """
    key = (key or "").strip().lower()
    if key not in ("owned", "wishlist"):
        raise HTTPException(status_code=400, detail="invalid_collection_type")

    existing = db.execute(
        select(ListModel)
        .where(
            ListModel.owner_id == user_id,
            ListModel.is_system.is_(True),
            ListModel.system_key == key,
        )
        .limit(1)
    ).scalar_one_or_none()

    if existing:
        return existing

    title = "Owned" if key == "owned" else "Wishlist"

    max_pos = db.execute(
        select(func.coalesce(func.max(ListModel.position), -1))
        .where(ListModel.owner_id == user_id)
    ).scalar_one()

    lst = ListModel(
        owner_id=user_id,
        title=title,
        description=None,
        is_public=False,
        position=int(max_pos) + 1,
        is_system=True,
        system_key=key,
    )
    db.add(lst)
    try:
        db.commit()
    except IntegrityError:
        # created concurrently; re-fetch
        db.rollback()
        existing2 = db.execute(
            select(ListModel)
            .where(
                ListModel.owner_id == user_id,
                ListModel.is_system.is_(True),
                ListModel.system_key == key,
            )
            .limit(1)
        ).scalar_one_or_none()
        if not existing2:
            raise
        return existing2

    db.refresh(lst)
    return lst


def _get_system_list_optional(db: Session, user_id: int, key: str) -> Optional[ListModel]:
    """
    Like _get_or_create_system_list, but DOES NOT create.
    Useful for idempotent delete endpoints (don't create lists on DELETE).
    """
    key = (key or "").strip().lower()
    if key not in ("owned", "wishlist"):
        return None

    return db.execute(
        select(ListModel)
        .where(
            ListModel.owner_id == user_id,
            ListModel.is_system.is_(True),
            ListModel.system_key == key,
        )
        .limit(1)
    ).scalar_one_or_none()


def _already_in_list(db: Session, list_id: int, set_num: str) -> bool:
    row = db.execute(
        select(ListItemModel)
        .where(ListItemModel.list_id == list_id, ListItemModel.set_num == set_num)
        .limit(1)
    ).scalar_one_or_none()
    return row is not None


def _append_item(db: Session, list_id: int, set_num: str) -> None:
    """
    Append at end (max position + 1). Idempotent on duplicates.
    """
    max_pos = db.execute(
        select(func.coalesce(func.max(ListItemModel.position), -1))
        .where(ListItemModel.list_id == list_id)
    ).scalar_one()

    db.add(ListItemModel(list_id=list_id, set_num=set_num, position=int(max_pos) + 1))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return  # idempotent success


def _compact_positions(db: Session, list_id: int) -> None:
    items = db.execute(
        select(ListItemModel)
        .where(ListItemModel.list_id == int(list_id))
        .order_by(
            ListItemModel.position.asc().nulls_last(),
            ListItemModel.created_at.asc(),
            ListItemModel.set_num.asc(),
        )
        .with_for_update()
    ).scalars().all()

    for i, li in enumerate(items):
        li.position = int(i)

    db.commit()


def _remove_item_idempotent(db: Session, list_id: int, set_num: str) -> int:
    deleted = (
        db.query(ListItemModel)
        .filter(ListItemModel.list_id == list_id, ListItemModel.set_num == set_num)
        .delete(synchronize_session=False)
    )
    db.commit()

    if int(deleted) > 0:
        _compact_positions(db, list_id)

    return int(deleted)


def _system_list_sets_query(list_id: int):
    return (
        select(SetModel, ListItemModel.created_at)
        .join(ListItemModel, ListItemModel.set_num == SetModel.set_num)
        .where(ListItemModel.list_id == list_id)
        .order_by(
            ListItemModel.position.asc().nulls_last(),
            ListItemModel.created_at.desc(),
            SetModel.set_num.asc(),
        )
    )


def _reorder_list_items_exact(db: Session, *, list_id: int, set_nums: TypingList[str]) -> None:
    """
    Exact reorder:
    - payload set_nums must contain EXACTLY the current items (same set, same length)
    - updates parent list updated_at (nice UX)
    """
    items = db.execute(
        select(ListItemModel)
        .where(ListItemModel.list_id == list_id)
        .with_for_update()
    ).scalars().all()

    current = [li.set_num for li in items]
    current_set = set(current)

    if not set_nums and not current:
        return

    canonical_order: TypingList[str] = [_resolve_set_num(db, s) for s in (set_nums or [])]

    if len(set(canonical_order)) != len(canonical_order):
        raise HTTPException(status_code=400, detail="set_nums_must_be_unique")

    if len(canonical_order) != len(current) or set(canonical_order) != current_set:
        raise HTTPException(status_code=400, detail="set_nums_must_match_all_items")

    by_set = {li.set_num: li for li in items}
    for pos, sn in enumerate(canonical_order):
        by_set[sn].position = int(pos)

    # bump list updated_at for better "recent activity" behavior
    db.query(ListModel).filter(ListModel.id == list_id).update({"updated_at": func.now()})

    db.commit()


# ---------- owned ----------
@router.post("/owned", status_code=status.HTTP_200_OK)
def add_owned(
    payload: Dict[str, str],
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    canonical = _resolve_set_num(db, payload.get("set_num", ""))

    owned_list = _get_or_create_system_list(db, int(current_user.id), "owned")
    wishlist_list = _get_or_create_system_list(db, int(current_user.id), "wishlist")

    if not _already_in_list(db, int(owned_list.id), canonical):
        _append_item(db, int(owned_list.id), canonical)

    # nice UX: if you mark owned, remove from wishlist (idempotent)
    _remove_item_idempotent(db, int(wishlist_list.id), canonical)

    return {"ok": True, "set_num": canonical, "type": "owned"}


@router.put("/owned/order", status_code=status.HTTP_200_OK)
def reorder_owned(
    payload: CollectionOrderUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    owned_list = _get_or_create_system_list(db, int(current_user.id), "owned")
    _reorder_list_items_exact(db, list_id=int(owned_list.id), set_nums=payload.set_nums or [])
    return {"ok": True, "type": "owned", "list_id": int(owned_list.id)}


from fastapi import Response, status

@router.delete("/owned/{set_num}", status_code=status.HTTP_204_NO_CONTENT)
def remove_owned(
    set_num: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    owned_list = _get_system_list_optional(db, int(current_user.id), "owned")
    if not owned_list:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    # idempotent delete: do NOT resolve set_num through DB
    for cand in _candidate_set_nums_for_delete(set_num):
        _remove_item_idempotent(db, int(owned_list.id), cand)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- wishlist ----------
@router.post("/wishlist", status_code=status.HTTP_200_OK)
def add_wishlist(
    payload: Dict[str, str],
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    canonical = _resolve_set_num(db, payload.get("set_num", ""))

    wishlist_list = _get_or_create_system_list(db, int(current_user.id), "wishlist")

    if not _already_in_list(db, int(wishlist_list.id), canonical):
        _append_item(db, int(wishlist_list.id), canonical)

    return {"ok": True, "set_num": canonical, "type": "wishlist"}


@router.put("/wishlist/order", status_code=status.HTTP_200_OK)
def reorder_wishlist(
    payload: CollectionOrderUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    wishlist_list = _get_or_create_system_list(db, int(current_user.id), "wishlist")
    _reorder_list_items_exact(db, list_id=int(wishlist_list.id), set_nums=payload.set_nums or [])
    return {"ok": True, "type": "wishlist", "list_id": int(wishlist_list.id)}


@router.delete("/wishlist/{set_num}", status_code=status.HTTP_204_NO_CONTENT)
def remove_wishlist(
    set_num: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    wishlist_list = _get_system_list_optional(db, int(current_user.id), "wishlist")
    if not wishlist_list:
        return Response(status_code=status.HTTP_204_NO_CONTENT)

    # idempotent delete: do NOT resolve set_num through DB
    for cand in _candidate_set_nums_for_delete(set_num):
        _remove_item_idempotent(db, int(wishlist_list.id), cand)

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# ---------- list my collections ----------
@router.get("/me/owned")
def list_my_owned(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    owned_list = _get_or_create_system_list(db, int(current_user.id), "owned")
    rows = db.execute(_system_list_sets_query(int(owned_list.id))).all()
    return [{**_set_to_dict(s), "collection_created_at": created_at} for (s, created_at) in rows]


@router.get("/me/wishlist")
def list_my_wishlist(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    wishlist_list = _get_or_create_system_list(db, int(current_user.id), "wishlist")
    rows = db.execute(_system_list_sets_query(int(wishlist_list.id))).all()
    return [{**_set_to_dict(s), "collection_created_at": created_at} for (s, created_at) in rows]


@router.get("/users/{username}/owned")
def list_owned_for_user(username: str, db: Session = Depends(get_db)):
    raise HTTPException(
        status_code=501,
        detail="Public user collections not wired yet (we can add next).",
    )