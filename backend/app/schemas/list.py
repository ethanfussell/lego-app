from datetime import datetime
from typing import List as TypingList, Dict, Any, Optional
from types import SimpleNamespace

from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel

router = APIRouter(prefix="/lists", tags=["lists"])


# ---------- Simple auth dependency (matches your fake token) ----------

def get_current_user(authorization: str = Header(default=None)):
    """
    Very simple auth:
    - Expects Authorization header like "Bearer fake-token-for-ethan"
    - Extracts username "ethan"
    """
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    parts = authorization.split()
    token = parts[1] if (len(parts) == 2 and parts[0].lower() == "bearer") else authorization

    prefix = "fake-token-for-"
    username = token[len(prefix):] if token.startswith(prefix) else token

    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    return SimpleNamespace(username=username)


# ---------- Pydantic models ----------

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
        from_attributes = True  # ok for dicts too


# ---------- In-memory store ----------

LISTS: TypingList[Dict[str, Any]] = []
NEXT_LIST_ID: int = 1


def _now() -> datetime:
    return datetime.utcnow()


def _next_position_for_owner(owner: str) -> int:
    positions = [lst.get("position", 0) for lst in LISTS if lst.get("owner") == owner]
    return (max(positions) + 1) if positions else 0


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


# ---------- Public lists ----------

@router.get("/public", response_model=TypingList[ListDetail])
def get_public_lists() -> TypingList[ListDetail]:
    public_lists = [lst for lst in LISTS if lst.get("is_public", True)]
    public_lists.sort(key=lambda x: (x.get("owner", ""), x.get("position", 0)))
    return [_to_detail_dict(lst) for lst in public_lists]


# ---------- My lists (requires auth) ----------

@router.get("/me", response_model=TypingList[ListDetail])
def get_my_lists(current_user=Depends(get_current_user)) -> TypingList[ListDetail]:
    username = current_user.username
    my_lists = [lst for lst in LISTS if lst.get("owner") == username]
    my_lists.sort(key=lambda x: x.get("position", 0))
    return [_to_detail_dict(lst) for lst in my_lists]


# ---------- Reorder my lists (requires auth) ----------

@router.put("/me/order", response_model=TypingList[ListDetail])
def reorder_my_lists(payload: ListOrderUpdate, current_user=Depends(get_current_user)) -> TypingList[ListDetail]:
    username = current_user.username
    mine = [lst for lst in LISTS if lst.get("owner") == username]
    mine_ids = [lst["id"] for lst in mine]

    # must include all ids exactly once
    if len(payload.ordered_ids) != len(mine_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ordered_ids must include ALL your list ids")

    if sorted(payload.ordered_ids) != sorted(mine_ids):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="ordered_ids must match your list ids exactly")

    by_id = {lst["id"]: lst for lst in mine}
    now = _now()
    for pos, list_id in enumerate(payload.ordered_ids):
        by_id[list_id]["position"] = pos
        by_id[list_id]["updated_at"] = now

    mine.sort(key=lambda x: x.get("position", 0))
    return [_to_detail_dict(lst) for lst in mine]


# ---------- Single list detail (view only) ----------

@router.get("/{list_id}", response_model=ListDetail)
def get_list_detail(list_id: int) -> ListDetail:
    for lst in LISTS:
        if lst["id"] == list_id:
            return _to_detail_dict(lst)
    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")


# ---------- Create list (requires auth) ----------

@router.post("", response_model=ListDetail, status_code=status.HTTP_201_CREATED)
def create_list(payload: ListCreate, current_user=Depends(get_current_user)) -> ListDetail:
    global NEXT_LIST_ID

    title = (payload.title or "").strip()
    if not title:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Title is required")

    now = _now()
    new_list = {
        "id": NEXT_LIST_ID,
        "title": title,
        "description": (payload.description.strip() if payload.description else None),
        "is_public": bool(payload.is_public),
        "owner": current_user.username,
        "items": [],
        "position": _next_position_for_owner(current_user.username),
        "created_at": now,
        "updated_at": now,
    }

    LISTS.append(new_list)
    NEXT_LIST_ID += 1
    return _to_detail_dict(new_list)


# ---------- Add item to list (requires owner) ----------

@router.post("/{list_id}/items", status_code=status.HTTP_201_CREATED)
def add_list_item(
    list_id: int,
    payload: ListItemCreate,
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    set_num = (payload.set_num or "").strip()
    if not set_num:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="set_num is required")

    for lst in LISTS:
        if lst["id"] == list_id:
            if lst.get("owner") != current_user.username:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this list")

            items = lst.setdefault("items", [])
            if set_num in items:
                raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Set already in list")

            items.append(set_num)
            lst["updated_at"] = _now()
            return {"ok": True, "items_count": len(items)}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")


# ---------- Remove item from list (requires owner) ----------

@router.delete("/{list_id}/items/{set_num}", status_code=status.HTTP_200_OK)
def remove_list_item(
    list_id: int,
    set_num: str,
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    set_num = (set_num or "").strip()
    if not set_num:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="set_num is required")

    for lst in LISTS:
        if lst["id"] == list_id:
            if lst.get("owner") != current_user.username:
                raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="You do not own this list")

            items = lst.setdefault("items", [])
            if set_num not in items:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Set not in list")

            items.remove(set_num)
            lst["updated_at"] = _now()
            return {"ok": True, "items_count": len(items)}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")