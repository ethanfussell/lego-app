# backend/app/routers/lists.py
from __future__ import annotations

from datetime import datetime
from types import SimpleNamespace
from typing import Any, Dict, List as TypingList, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, status
from pydantic import BaseModel

from app.data import lists as store


router = APIRouter(prefix="/lists", tags=["lists"])


# -------------------------
# Auth (fake token)
# -------------------------
def get_current_user(authorization: str = Header(default=None)):
    """
    Expects Authorization header like:
      Authorization: Bearer fake-token-for-ethan

    Extracts username: "ethan"
    """
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    parts = authorization.split()
    token = parts[1] if (len(parts) == 2 and parts[0].lower() == "bearer") else authorization

    prefix = "fake-token-for-"
    username = token[len(prefix):] if token.startswith(prefix) else token

    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    return SimpleNamespace(username=username)


def get_current_user_optional(authorization: str = Header(default=None)):
    if not authorization:
        return None
    try:
        return get_current_user(authorization)
    except HTTPException:
        return None


# -------------------------
# Pydantic models
# -------------------------
class ListCreate(BaseModel):
    title: str
    description: Optional[str] = None
    is_public: bool = True


class ListItemCreate(BaseModel):
    set_num: str


class ListOrderUpdate(BaseModel):
    ordered_ids: TypingList[int]


class ListDetail(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    is_public: bool = True
    owner: str
    items: TypingList[str] = []
    items_count: int
    position: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # ok if you're on pydantic v2; harmless for dict output


def _to_detail_dict(raw: Dict[str, Any]) -> Dict[str, Any]:
    items = raw.get("items") or []
    return {
        "id": raw["id"],
        "title": raw["title"],
        "description": raw.get("description"),
        "is_public": raw.get("is_public", True),
        "owner": raw["owner"],
        "items": items,
        "items_count": len(items),
        "position": int(raw.get("position", 0) or 0),
        "created_at": raw["created_at"],
        "updated_at": raw["updated_at"],
    }


# -------------------------
# Routes
# -------------------------

@router.get("/public", response_model=TypingList[ListDetail])
def get_public_lists() -> TypingList[ListDetail]:
    public_lists = store.list_public()
    return [_to_detail_dict(lst) for lst in public_lists]


@router.get("/me", response_model=TypingList[ListDetail])
def get_my_lists(current_user=Depends(get_current_user)) -> TypingList[ListDetail]:
    mine = store.list_for_user(current_user.username)
    return [_to_detail_dict(lst) for lst in mine]


@router.get("/{list_id}", response_model=ListDetail)
def get_list_detail(list_id: int, current_user=Depends(get_current_user_optional)) -> ListDetail:
    try:
        lst = store.get_list(list_id)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")

    # If private, only owner can view
    is_public = lst.get("is_public", True)
    if not is_public:
        if not current_user or lst.get("owner") != current_user.username:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This list is private")

    return _to_detail_dict(lst)


@router.post("", response_model=ListDetail, status_code=status.HTTP_201_CREATED)
def create_list(payload: ListCreate, current_user=Depends(get_current_user)) -> ListDetail:
    title = (payload.title or "").strip()
    if not title:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Title is required")

    new_list = store.create_list(
        owner=current_user.username,
        title=title,
        description=(payload.description.strip() if payload.description else None),
        is_public=payload.is_public,
    )
    return _to_detail_dict(new_list)


@router.post("/{list_id}/items", status_code=status.HTTP_201_CREATED)
def add_list_item(
    list_id: int,
    payload: ListItemCreate,
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    set_num = (payload.set_num or "").strip()
    if not set_num:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="set_num is required")

    try:
        count = store.add_item(current_user.username, list_id, set_num)
        return {"ok": True, "items_count": count}
    except KeyError as e:
        if str(e) == "'list_not_found'" or str(e) == "list_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this list")
    except ValueError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Set already in list")


@router.delete("/{list_id}/items/{set_num}", status_code=status.HTTP_200_OK)
def remove_list_item(
    list_id: int,
    set_num: str,
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    set_num = (set_num or "").strip()
    if not set_num:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="set_num is required")

    try:
        count = store.remove_item(current_user.username, list_id, set_num)
        return {"ok": True, "items_count": count}
    except KeyError as e:
        if str(e) == "'list_not_found'" or str(e) == "list_not_found":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")
        if str(e) == "'set_not_in_list'" or str(e) == "set_not_in_list":
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Set not in list")
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    except PermissionError:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this list")


@router.put("/me/order", response_model=TypingList[ListDetail])
def reorder_my_lists(
    payload: ListOrderUpdate,
    current_user=Depends(get_current_user),
) -> TypingList[ListDetail]:
    try:
        ordered = store.reorder_lists(current_user.username, payload.ordered_ids)
        return [_to_detail_dict(lst) for lst in ordered]
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))