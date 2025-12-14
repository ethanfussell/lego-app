# backend/app/routers/collections.py
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.auth import get_current_user
from ..db import get_db
from ..models import Collection as CollectionModel, Set as SetModel, User as UserModel

router = APIRouter()


def _resolve_set_num(db: Session, set_num_or_plain: str) -> str:
    """
    Accepts '10305' or '10305-1' and returns canonical set_num in DB ('10305-1').
    """
    raw = (set_num_or_plain or "").strip()
    if not raw:
        raise HTTPException(status_code=404, detail="Set not found")

    plain = raw.split("-")[0].lower()
    plain_expr = func.split_part(SetModel.set_num, "-", 1)

    canonical = db.execute(
        select(SetModel.set_num)
        .where(
            or_(
                func.lower(SetModel.set_num) == raw.lower(),
                func.lower(plain_expr) == plain,
            )
        )
        .limit(1)
    ).scalar_one_or_none()

    if not canonical:
        raise HTTPException(status_code=404, detail="Set not found")

    return canonical


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


def _collection_sets_query(user_id: int, type_: str):
    return (
        select(SetModel, CollectionModel.created_at)
        .join(CollectionModel, CollectionModel.set_num == SetModel.set_num)
        .where(CollectionModel.user_id == user_id, CollectionModel.type == type_)
        .order_by(CollectionModel.created_at.desc())
    )


def _already_in_collection(db: Session, user_id: int, set_num: str, type_: str) -> bool:
    row = db.execute(
        select(CollectionModel)
        .where(
            CollectionModel.user_id == user_id,
            CollectionModel.set_num == set_num,
            CollectionModel.type == type_,
        )
        .limit(1)
    ).scalar_one_or_none()
    return row is not None


def _add_collection_row(db: Session, user_id: int, set_num: str, type_: str) -> None:
    """
    Insert row and commit. If duplicate, swallow it (idempotent).
    """
    db.add(CollectionModel(user_id=user_id, set_num=set_num, type=type_))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # idempotent success: row already exists
        return


def _remove_from_collection(db: Session, user_id: int, set_num: str, type_: str) -> int:
    deleted = (
        db.query(CollectionModel)
        .filter(
            CollectionModel.user_id == user_id,
            CollectionModel.set_num == set_num,
            CollectionModel.type == type_,
        )
        .delete(synchronize_session=False)
    )
    db.commit()
    return int(deleted)


@router.post("/owned", status_code=status.HTTP_200_OK)
def add_owned(
    payload: Dict[str, str],
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    canonical = _resolve_set_num(db, payload.get("set_num", ""))

    # If already owned, treat as success (idempotent)
    if _already_in_collection(db, current_user.id, canonical, "owned"):
        # Also ensure it's not in wishlist (nice UX)
        db.query(CollectionModel).filter(
            CollectionModel.user_id == current_user.id,
            CollectionModel.set_num == canonical,
            CollectionModel.type == "wishlist",
        ).delete(synchronize_session=False)
        db.commit()
        return {"ok": True, "set_num": canonical, "type": "owned"}

    # Add owned + remove wishlist in one transaction
    db.add(CollectionModel(user_id=current_user.id, set_num=canonical, type="owned"))
    db.query(CollectionModel).filter(
        CollectionModel.user_id == current_user.id,
        CollectionModel.set_num == canonical,
        CollectionModel.type == "wishlist",
    ).delete(synchronize_session=False)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        # If a race/double-post happened, still treat as success
        return {"ok": True, "set_num": canonical, "type": "owned"}

    return {"ok": True, "set_num": canonical, "type": "owned"}


@router.delete("/owned/{set_num}", status_code=status.HTTP_204_NO_CONTENT)
def remove_owned(
    set_num: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    canonical = _resolve_set_num(db, set_num)

    deleted = _remove_from_collection(db, current_user.id, canonical, "owned")
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Not in owned")
    return None


@router.post("/wishlist", status_code=status.HTTP_200_OK)
def add_wishlist(
    payload: Dict[str, str],
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    canonical = _resolve_set_num(db, payload.get("set_num", ""))

    # If already in wishlist, treat as success (idempotent)
    if _already_in_collection(db, current_user.id, canonical, "wishlist"):
        return {"ok": True, "set_num": canonical, "type": "wishlist"}

    _add_collection_row(db, current_user.id, canonical, "wishlist")
    return {"ok": True, "set_num": canonical, "type": "wishlist"}


@router.delete("/wishlist/{set_num}", status_code=status.HTTP_204_NO_CONTENT)
def remove_wishlist(
    set_num: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    canonical = _resolve_set_num(db, set_num)

    deleted = _remove_from_collection(db, current_user.id, canonical, "wishlist")
    if deleted == 0:
        raise HTTPException(status_code=404, detail="Not in wishlist")
    return None


@router.get("/me/owned")
def list_my_owned(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    rows = db.execute(_collection_sets_query(current_user.id, "owned")).all()
    return [{**_set_to_dict(s), "collection_created_at": created_at} for (s, created_at) in rows]


@router.get("/me/wishlist")
def list_my_wishlist(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    rows = db.execute(_collection_sets_query(current_user.id, "wishlist")).all()
    return [{**_set_to_dict(s), "collection_created_at": created_at} for (s, created_at) in rows]


@router.get("/users/{username}/owned")
def list_owned_for_user(username: str, db: Session = Depends(get_db)):
    raise HTTPException(
        status_code=501,
        detail="Public user collections not wired yet (we can add next).",
    )