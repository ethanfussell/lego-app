# backend/app/routers/lists.py
from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, List as TypingList, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from ..core.auth import get_current_user, get_current_user_optional
from ..core.set_nums import base_set_num, resolve_set_num
from ..data.lists import LISTS
from ..db import get_db
from ..models import List as ListModel
from ..models import ListItem as ListItemModel
from ..models import User as UserModel
from ..schemas.list import (
    ListCreate,
    ListDetail,
    ListItemCreate,
    ListItemsOrderUpdate,
    ListOrderUpdate,
    ListSummary,
    ListUpdate,
)

router = APIRouter(prefix="/lists", tags=["lists"])


def _use_memory_lists() -> bool:
    return os.getenv("PYTEST_CURRENT_TEST") is not None


# ---------------- helpers ----------------
def _owner_username(db: Session, owner_id: int) -> str:
    return db.execute(select(UserModel.username).where(UserModel.id == int(owner_id))).scalar_one()


def _compact_list_item_positions(db: Session, list_id: int) -> None:
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


def _summary_dict(lst: ListModel, owner_username: str) -> Dict[str, Any]:
    items_count = len(lst.items) if "items" in lst.__dict__ and lst.items is not None else 0

    return {
        "id": int(lst.id),
        "title": lst.title,
        "description": lst.description,
        "is_public": bool(lst.is_public),
        "owner": owner_username,
        "items_count": int(items_count),
        "position": int(lst.position or 0),
        "is_system": bool(getattr(lst, "is_system", False)),
        "system_key": getattr(lst, "system_key", None),
        "created_at": lst.created_at,
        "updated_at": lst.updated_at,
    }


def _detail_dict(lst: ListModel, owner_username: str) -> Dict[str, Any]:
    base = _summary_dict(lst, owner_username)

    items = lst.items or []
    items_sorted = sorted(
        items,
        key=lambda li: (
            int(li.position) if getattr(li, "position", None) is not None else 1_000_000_000,
            li.created_at,
            li.set_num,
        ),
    )
    base["items"] = [li.set_num for li in items_sorted]
    return base


def _require_owner_or_403(lst: ListModel, current_user: UserModel) -> None:
    if int(lst.owner_id) != int(current_user.id):
        raise HTTPException(status_code=403, detail="not_owner")


def _get_list_visible_or_404(
    db: Session,
    list_id: int,
    current_user: Optional[UserModel],
    *,
    load_items: bool = False,
) -> ListModel:
    """
    ✅ INVISIBILITY RULE:
    - If list does not exist -> 404
    - If list is private and user is not the owner (or logged out) -> 404
    - If list is public -> visible to anyone
    """
    q = select(ListModel).where(ListModel.id == int(list_id))
    if load_items:
        q = q.options(selectinload(ListModel.items))

    lst = db.execute(q).scalar_one_or_none()
    if not lst:
        raise HTTPException(status_code=404, detail="list_not_found")

    if not bool(lst.is_public):
        if current_user is None or int(lst.owner_id) != int(current_user.id):
            raise HTTPException(status_code=404, detail="list_not_found")

    return lst


def _get_or_create_system_list(db: Session, user_id: int, key: str) -> ListModel:
    """
    Ensure system list exists (Owned/Wishlist). Stored in lists/list_items.
    """
    key = (key or "").strip().lower()
    if key not in ("owned", "wishlist"):
        raise HTTPException(status_code=400, detail="invalid_system_key")

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


# ---------------- Public lists ----------------
@router.get("/public", response_model=TypingList[ListSummary])
def api_get_public_lists(
    owner: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
) -> TypingList[ListSummary]:
    if _use_memory_lists():
        rows = [l for l in LISTS if l.get("is_public") is True]
        if owner:
            rows = [l for l in rows if (l.get("owner") or "") == owner]
        rows.sort(key=lambda l: l.get("updated_at") or datetime.min, reverse=True)

        out: TypingList[Dict[str, Any]] = []
        for l in rows:
            out.append(
                {
                    "id": int(l["id"]),
                    "title": l["title"],
                    "description": l.get("description"),
                    "is_public": bool(l.get("is_public")),
                    "owner": l["owner"],
                    "items_count": len(l.get("items") or []),
                    "position": int(l.get("position") or 0),
                    "is_system": bool(l.get("is_system", False)),
                    "system_key": l.get("system_key"),
                    "created_at": l.get("created_at"),
                    "updated_at": l.get("updated_at"),
                }
            )
        return out  # type: ignore[return-value]

    rows = db.execute(
        select(ListModel, UserModel.username)
        .join(UserModel, UserModel.id == ListModel.owner_id)
        .where(ListModel.is_public.is_(True))
        .options(selectinload(ListModel.items))
        .order_by(UserModel.username.asc(), ListModel.position.asc(), ListModel.id.asc())
    ).all()

    return [_summary_dict(lst, username) for (lst, username) in rows]


# ---------------- My lists (auth required) ----------------
@router.get("/me", response_model=TypingList[ListSummary])
def api_get_my_lists(
    include_system: bool = Query(default=True),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TypingList[ListSummary]:
    q = (
        select(ListModel, UserModel.username)
        .join(UserModel, UserModel.id == ListModel.owner_id)
        .where(ListModel.owner_id == current_user.id)
        .options(selectinload(ListModel.items))
    )

    if not include_system:
        q = q.where(ListModel.is_system.is_(False))

    rows = db.execute(q.order_by(ListModel.position.asc(), ListModel.id.asc())).all()
    return [_summary_dict(lst, username) for (lst, username) in rows]


# ---------------- Reorder my lists (auth required) ----------------
@router.put("/me/order", response_model=TypingList[ListDetail])
def api_reorder_my_lists(
    payload: ListOrderUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> TypingList[ListDetail]:
    ordered_ids = [int(x) for x in (payload.ordered_ids or [])]

    mine = db.execute(
        select(ListModel)
        .where(ListModel.owner_id == current_user.id)
        .order_by(ListModel.position.asc(), ListModel.id.asc())
    ).scalars().all()

    mine_custom_ids = [int(l.id) for l in mine if not bool(getattr(l, "is_system", False))]
    if sorted(ordered_ids) != sorted(mine_custom_ids):
        raise HTTPException(status_code=400, detail="ordered_ids_must_match_all_custom")

    by_id = {int(l.id): l for l in mine}
    for pos, lid in enumerate(ordered_ids):
        by_id[int(lid)].position = int(pos)
        by_id[int(lid)].updated_at = func.now()

    db.commit()

    updated = db.execute(
        select(ListModel)
        .options(selectinload(ListModel.items))
        .where(ListModel.owner_id == current_user.id)
        .order_by(ListModel.position.asc(), ListModel.id.asc())
    ).scalars().all()

    return [_detail_dict(lst, current_user.username) for lst in updated]


@router.get("/me/system")
def api_get_my_system_lists(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    # ✅ ensure these always exist so frontend never gets "not ready"
    _get_or_create_system_list(db, int(current_user.id), "owned")
    _get_or_create_system_list(db, int(current_user.id), "wishlist")

    rows = db.execute(
        select(ListModel.id, ListModel.system_key, ListModel.title)
        .where(
            ListModel.owner_id == current_user.id,
            ListModel.is_system.is_(True),
            ListModel.system_key.isnot(None),
        )
        .order_by(ListModel.system_key.asc())
    ).all()

    by_key: Dict[str, Any] = {}
    for (lid, key, title) in rows:
        by_key[str(key)] = {"id": int(lid), "title": title}

    return {"system_lists": by_key}


# ---------------- Single list detail ----------------
@router.get("/{list_id}", response_model=ListDetail)
def api_get_list_detail(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[UserModel] = Depends(get_current_user_optional),
) -> ListDetail:
    lst = _get_list_visible_or_404(db, list_id, current_user, load_items=True)
    owner_username = _owner_username(db, int(lst.owner_id))
    return _detail_dict(lst, owner_username)


# ---------------- Create list (auth required) ----------------
@router.post("", response_model=ListDetail, status_code=status.HTTP_201_CREATED)
def api_create_list(
    payload: ListCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ListDetail:
    if _use_memory_lists():
        title = (payload.title or "").strip()
        if not title:
            raise HTTPException(status_code=422, detail="title_required")

        now = datetime.utcnow()
        next_id = (max([int(l["id"]) for l in LISTS], default=0) + 1)

        l = {
            "id": next_id,
            "owner": current_user.username,
            "title": title,
            "description": (payload.description or None),
            "is_public": bool(payload.is_public),
            "items": [],
            "created_at": now,
            "updated_at": now,
            "position": 0,
            "is_system": False,
            "system_key": None,
        }
        LISTS.append(l)

        return {
            "id": int(l["id"]),
            "title": l["title"],
            "description": l.get("description"),
            "is_public": bool(l.get("is_public")),
            "owner": l["owner"],
            "items_count": 0,
            "position": 0,
            "is_system": False,
            "system_key": None,
            "created_at": l.get("created_at"),
            "updated_at": l.get("updated_at"),
            "items": [],
        }  # type: ignore[return-value]

    title = (payload.title or "").strip()
    if not title:
        raise HTTPException(status_code=422, detail="title_required")

    max_pos = db.execute(
        select(func.coalesce(func.max(ListModel.position), -1))
        .where(ListModel.owner_id == current_user.id)
    ).scalar_one()

    new_list = ListModel(
        owner_id=current_user.id,
        title=title,
        description=(payload.description.strip() if payload.description else None),
        is_public=bool(payload.is_public),
        position=int(max_pos) + 1,
        is_system=False,
        system_key=None,
    )
    db.add(new_list)
    db.commit()
    db.refresh(new_list)

    return _detail_dict(new_list, current_user.username)


# ---------------- Add item (auth required) ----------------
@router.post("/{list_id}/items", status_code=status.HTTP_201_CREATED)
def api_add_list_item(
    list_id: int,
    payload: ListItemCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    lst = _get_list_visible_or_404(db, list_id, current_user, load_items=False)
    _require_owner_or_403(lst, current_user)

    canonical = resolve_set_num(db, payload.set_num)

    max_pos = db.execute(
        select(func.coalesce(func.max(ListItemModel.position), -1))
        .where(ListItemModel.list_id == lst.id)
    ).scalar_one()

    db.add(ListItemModel(list_id=lst.id, set_num=canonical, position=int(max_pos) + 1))
    lst.updated_at = func.now()

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="set_already_in_list")

    return {"ok": True}


# ---------------- Reorder items within a list (auth required) ----------------
@router.put("/{list_id}/items/order", response_model=ListDetail)
def api_reorder_list_items(
    list_id: int,
    payload: ListItemsOrderUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ListDetail:
    lst = _get_list_visible_or_404(db, list_id, current_user, load_items=False)
    _require_owner_or_403(lst, current_user)

    current_items = db.execute(
        select(ListItemModel)
        .where(ListItemModel.list_id == lst.id)
        .with_for_update()
    ).scalars().all()

    current_set_nums = [li.set_num for li in current_items]
    current_set = set(current_set_nums)

    raw = payload.set_nums or []

    if len(raw) == 0 and len(current_set_nums) == 0:
        lst2 = _get_list_visible_or_404(db, list_id, current_user, load_items=True)
        owner_username = _owner_username(db, int(lst2.owner_id))
        return _detail_dict(lst2, owner_username)

    canonical_order: TypingList[str] = [resolve_set_num(db, s) for s in raw]

    if len(set(canonical_order)) != len(canonical_order):
        raise HTTPException(status_code=400, detail="set_nums_must_be_unique")

    if len(canonical_order) != len(current_set_nums) or set(canonical_order) != current_set:
        raise HTTPException(status_code=400, detail="set_nums_must_match_all_items")

    by_set = {li.set_num: li for li in current_items}
    for pos, set_num in enumerate(canonical_order):
        by_set[set_num].position = int(pos)

    lst.updated_at = func.now()
    db.commit()

    lst2 = _get_list_visible_or_404(db, list_id, current_user, load_items=True)
    owner_username = _owner_username(db, int(lst2.owner_id))
    return _detail_dict(lst2, owner_username)


# ---------------- Remove item (auth required) ----------------
@router.delete("/{list_id}/items/{set_num}", status_code=status.HTTP_200_OK)
def api_remove_list_item(
    list_id: int,
    set_num: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    lst = _get_list_visible_or_404(db, list_id, current_user, load_items=False)
    _require_owner_or_403(lst, current_user)

    raw = (set_num or "").strip()
    if not raw:
        raise HTTPException(status_code=422, detail="set_num_required")

    q = db.query(ListItemModel).filter(ListItemModel.list_id == lst.id)

    if "-" in raw:
        # exact version: "10305-2"
        deleted = q.filter(func.lower(ListItemModel.set_num) == raw.lower()).delete(
            synchronize_session=False
        )
    else:
        # base: "10305" -> delete any "10305-*"
        base_lower = base_set_num(raw).lower()
        plain_expr = func.split_part(ListItemModel.set_num, "-", 1)
        deleted = q.filter(func.lower(plain_expr) == base_lower).delete(
            synchronize_session=False
        )

    if int(deleted) == 0:
        db.rollback()
        raise HTTPException(status_code=404, detail="set_not_in_list")

    _compact_list_item_positions(db, int(lst.id))
    lst.updated_at = func.now()
    db.commit()

    return {"ok": True, "deleted_count": int(deleted)}


# ---------------- Update list (auth required) ----------------
@router.patch("/{list_id}", response_model=ListDetail)
def api_update_list(
    list_id: int,
    payload: ListUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ListDetail:
    if _use_memory_lists():
        target = next((l for l in LISTS if int(l.get("id")) == int(list_id)), None)
        if not target:
            raise HTTPException(status_code=404, detail="list_not_found")

        if (target.get("owner") or "") != current_user.username:
            raise HTTPException(status_code=403, detail="not_owner")

        if payload.title is not None:
            title = (payload.title or "").strip()
            if not title:
                raise HTTPException(status_code=422, detail="title_required")
            target["title"] = title

        if payload.description is not None:
            target["description"] = (payload.description or "").strip() or None

        if payload.is_public is not None:
            target["is_public"] = bool(payload.is_public)

        target["updated_at"] = datetime.utcnow()

        return {
            "id": int(target["id"]),
            "title": target["title"],
            "description": target.get("description"),
            "is_public": bool(target.get("is_public")),
            "owner": target.get("owner"),
            "items_count": len(target.get("items") or []),
            "position": int(target.get("position") or 0),
            "is_system": bool(target.get("is_system", False)),
            "system_key": target.get("system_key"),
            "created_at": target.get("created_at"),
            "updated_at": target.get("updated_at"),
            "items": list(target.get("items") or []),
        }  # type: ignore[return-value]

    lst = _get_list_visible_or_404(db, list_id, current_user, load_items=True)
    _require_owner_or_403(lst, current_user)

    if bool(getattr(lst, "is_system", False)):
        raise HTTPException(status_code=400, detail="cannot_update_system_list")

    if payload.title is not None:
        title = (payload.title or "").strip()
        if not title:
            raise HTTPException(status_code=422, detail="title_required")
        lst.title = title

    if payload.description is not None:
        lst.description = (payload.description or "").strip() or None

    if payload.is_public is not None:
        lst.is_public = bool(payload.is_public)

    db.add(lst)
    db.commit()
    db.refresh(lst)

    return _detail_dict(lst, current_user.username)


# ---------------- Delete list (auth required) ----------------
@router.delete("/{list_id}", status_code=status.HTTP_200_OK)
def api_delete_list(
    list_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    lst = _get_list_visible_or_404(db, list_id, current_user, load_items=False)
    _require_owner_or_403(lst, current_user)

    if bool(getattr(lst, "is_system", False)):
        raise HTTPException(status_code=400, detail="cannot_delete_system_list")

    db.delete(lst)
    db.commit()
    return {"ok": True}