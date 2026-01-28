# backend/app/routers/collections.py
from __future__ import annotations

from typing import Any, Dict, List as TypingList, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.set_nums import base_set_num
from app.data.sets import get_set_by_num
from app.db import get_db
from app.models import List as ListModel
from app.models import ListItem as ListItemModel
from app.models import Set as SetModel
from app.models import User as UserModel

router = APIRouter(tags=["collections"])


class CollectionOrderUpdate(BaseModel):
    set_nums: TypingList[str] = Field(default_factory=list)


# ---------------- helpers ----------------

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


def _canonicalize_and_ensure_set(db: Session, raw: str) -> str:
    """
    - Canonicalize using cached sets (same behavior as /sets/{set_num})
    - Ensure a SetModel row exists so joins work
    """
    raw = (raw or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="missing_set_num")

    s = get_set_by_num(raw)
    if not s:
        raise HTTPException(status_code=404, detail="set_not_found")

    canonical = str(s.get("set_num") or "").strip()
    if not canonical:
        raise HTTPException(status_code=404, detail="set_not_found")

    # ensure SetModel row exists
    row = db.execute(
        select(SetModel).where(SetModel.set_num == canonical).limit(1)
    ).scalar_one_or_none()

    if not row:
        row = SetModel(
            set_num=canonical,
            name=str(s.get("name") or ""),
            year=s.get("year"),
            pieces=s.get("pieces"),
            theme=str(s.get("theme") or ""),
            image_url=str(s.get("image_url") or ""),
        )
        db.add(row)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    else:
        # light backfill if missing
        changed = False
        if not (row.name or "").strip() and s.get("name"):
            row.name = str(s.get("name") or "")
            changed = True
        if not (row.image_url or "").strip() and s.get("image_url"):
            row.image_url = str(s.get("image_url") or "")
            changed = True
        if changed:
            db.commit()

    return canonical


def _get_or_create_system_list(db: Session, user_id: int, key: str) -> ListModel:
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


def _already_in_list(db: Session, list_id: int, set_num: str) -> bool:
    row = db.execute(
        select(ListItemModel)
        .where(ListItemModel.list_id == list_id, ListItemModel.set_num == set_num)
        .limit(1)
    ).scalar_one_or_none()
    return row is not None


def _append_item(db: Session, list_id: int, set_num: str) -> None:
    max_pos = db.execute(
        select(func.coalesce(func.max(ListItemModel.position), -1))
        .where(ListItemModel.list_id == list_id)
    ).scalar_one()

    db.add(ListItemModel(list_id=list_id, set_num=set_num, position=int(max_pos) + 1))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return


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


def _remove_item_idempotent_by_base_or_exact(db: Session, list_id: int, raw: str) -> int:
    s = (raw or "").strip()
    if not s:
        return 0

    q = db.query(ListItemModel).filter(ListItemModel.list_id == list_id)

    # exact: "10305-1"
    if "-" in s:
        deleted = q.filter(func.lower(ListItemModel.set_num) == s.lower()).delete(synchronize_session=False)
        db.commit()
        if int(deleted) > 0:
            _compact_positions(db, list_id)
        return int(deleted)

    # base: "10305"
    base_lower = base_set_num(s).lower()
    plain_expr = func.split_part(ListItemModel.set_num, "-", 1)
    deleted = q.filter(func.lower(plain_expr) == base_lower).delete(synchronize_session=False)
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
    items = db.execute(
        select(ListItemModel)
        .where(ListItemModel.list_id == list_id)
        .with_for_update()
    ).scalars().all()

    current = [li.set_num for li in items]
    current_set = set(current)

    if not set_nums and not current:
        return

    canonical_order: TypingList[str] = [_canonicalize_and_ensure_set(db, s) for s in (set_nums or [])]

    if len(set(canonical_order)) != len(canonical_order):
        raise HTTPException(status_code=400, detail="set_nums_must_be_unique")

    if len(canonical_order) != len(current) or set(canonical_order) != current_set:
        raise HTTPException(status_code=400, detail="set_nums_must_match_all_items")

    by_set = {li.set_num: li for li in items}
    for pos, sn in enumerate(canonical_order):
        by_set[sn].position = int(pos)

    db.query(ListModel).filter(ListModel.id == list_id).update({"updated_at": func.now()})
    db.commit()


# ---------------- endpoints ----------------

@router.post("/owned", status_code=status.HTTP_200_OK)
def add_owned(
    payload: Dict[str, str],
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    canonical = _canonicalize_and_ensure_set(db, payload.get("set_num") or "")

    owned_list = _get_or_create_system_list(db, int(current_user.id), "owned")
    wishlist_list = _get_or_create_system_list(db, int(current_user.id), "wishlist")

    if not _already_in_list(db, int(owned_list.id), canonical):
        _append_item(db, int(owned_list.id), canonical)

    _remove_item_idempotent_by_base_or_exact(db, int(wishlist_list.id), base_set_num(canonical))
    return {"ok": True, "set_num": canonical, "type": "owned"}


@router.get("/me/owned")
def list_my_owned(
    db: Session = Depends(get_db),
    current_user: UserModel = Depends(get_current_user),
):
    owned_list = _get_or_create_system_list(db, int(current_user.id), "owned")
    rows = db.execute(_system_list_sets_query(int(owned_list.id))).all()
    return [{**_set_to_dict(s), "collection_created_at": created_at} for (s, created_at) in rows]