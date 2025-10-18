# app/routers/lists.py
from fastapi import APIRouter, HTTPException, status, Query
from typing import Optional, List
from datetime import datetime

from app.data.lists import LISTS
from app.data.sets import SETS
from app.schemas.list import (
    ListCreate, ListUpdate, ListSummary, UserList,
    ListItemCreate, ReorderPayload, ActorPayload
)

router = APIRouter()

# ---- helpers ----
_set_index = {s["set_num"]: s for s in SETS}

def _next_list_id() -> int:
    return (max((l["id"] for l in LISTS), default=0) + 1)

def _get_list(list_id: int) -> dict | None:
    for l in LISTS:
        if l["id"] == list_id:
            return l
    return None

def _ensure_owner(l: dict, user: str):
    if l["owner"] != user:
        raise HTTPException(status_code=403, detail="Only the owner can modify this list")

def _set_exists(set_num: str) -> bool:
    return any(s["set_num"] == set_num for s in SETS)

def _summarize(l: dict) -> dict:
    return {
        "id": l["id"],
        "owner": l["owner"],
        "name": l["name"],
        "description": l.get("description"),
        "is_public": l["is_public"],
        "created_at": l["created_at"],
        "updated_at": l["updated_at"],
        "items_count": len(l["items"]),
    }

# ---- create a list ----
@router.post("", status_code=status.HTTP_201_CREATED, response_model=UserList)
def create_list(payload: ListCreate):
    now = datetime.utcnow()
    l = {
        "id": _next_list_id(),
        "owner": payload.owner,
        "name": payload.name,
        "description": payload.description,
        "is_public": payload.is_public,
        "created_at": now,
        "updated_at": now,
        "items": [],
    }
    LISTS.append(l)
    return l

# ---- get one list (owner can see private; others only if public) ----
@router.get("/{list_id}", response_model=UserList)
def get_list(list_id: int, viewer: Optional[str] = Query(None, description="optional viewer username")):
    l = _get_list(list_id)
    if not l:
        raise HTTPException(status_code=404, detail="List not found")
    if not l["is_public"] and viewer != l["owner"]:
        raise HTTPException(status_code=403, detail="List is private")
    return l

# ---- list summaries (mine or public) ----
@router.get("", response_model=List[ListSummary])
def list_lists(
    owner: Optional[str] = Query(None, description="Filter by owner"),
    only_public: bool = Query(True, description="If owner not provided, show only public lists"),
):
    results = LISTS
    if owner:
        results = [l for l in LISTS if l["owner"] == owner]
    elif only_public:
        results = [l for l in LISTS if l["is_public"]]
    return [_summarize(l) for l in results]

# ---- update list meta ----
@router.put("/{list_id}", response_model=UserList)
def update_list(list_id: int, payload: ListUpdate):
    l = _get_list(list_id)
    if not l:
        raise HTTPException(status_code=404, detail="List not found")
    _ensure_owner(l, payload.user)
    if payload.name is not None:
        l["name"] = payload.name
    if payload.description is not None:
        l["description"] = payload.description
    if payload.is_public is not None:
        l["is_public"] = payload.is_public
    l["updated_at"] = datetime.utcnow()
    return l

# ---- delete list ----
@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list(list_id: int, payload: ActorPayload):
    l = _get_list(list_id)
    if not l:
        raise HTTPException(status_code=404, detail="List not found")
    _ensure_owner(l, payload.user)
    LISTS.remove(l)
    return

# ---- add item ----
@router.post("/{list_id}/items", response_model=UserList)
def add_item(list_id: int, payload: ListItemCreate):
    l = _get_list(list_id)
    if not l:
        raise HTTPException(status_code=404, detail="List not found")
    # NOTE: in a real app, we’d infer the user from auth; for now, enforce via update/delete endpoints.
    if not _set_exists(payload.set_num):
        raise HTTPException(status_code=404, detail="Set not found")

    # prevent duplicates
    if any(it["set_num"] == payload.set_num for it in l["items"]):
        raise HTTPException(status_code=409, detail="Set already in list")

    pos = payload.position
    if pos is None or pos < 1 or pos > len(l["items"]) + 1:
        pos = len(l["items"]) + 1

    item = {
        "set_num": payload.set_num,
        "note": payload.note,
        "position": pos,
        "added_at": datetime.utcnow(),
    }

    # insert and re-number positions
    l["items"].insert(pos - 1, item)
    for i, it in enumerate(l["items"], start=1):
        it["position"] = i
    l["updated_at"] = datetime.utcnow()
    return l

# ---- remove item ----
@router.delete("/{list_id}/items/{set_num}", response_model=UserList)
def remove_item(list_id: int, set_num: str, payload: ActorPayload):
    l = _get_list(list_id)
    if not l:
        raise HTTPException(status_code=404, detail="List not found")
    _ensure_owner(l, payload.user)

    idx = next((i for i, it in enumerate(l["items"]) if it["set_num"] == set_num), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Set not in list")

    l["items"].pop(idx)
    for i, it in enumerate(l["items"], start=1):
        it["position"] = i
    l["updated_at"] = datetime.utcnow()
    return l

# ---- reorder items ----
@router.post("/{list_id}/reorder", response_model=UserList)
def reorder_items(list_id: int, payload: ReorderPayload):
    l = _get_list(list_id)
    if not l:
        raise HTTPException(status_code=404, detail="List not found")
    _ensure_owner(l, payload.user)

    current = [it["set_num"] for it in l["items"]]
    new = payload.set_nums

    if sorted(current) != sorted(new):
        raise HTTPException(status_code=400, detail="set_nums must be a permutation of the current items")

    # rebuild in the given order
    new_items = []
    lookup = {it["set_num"]: it for it in l["items"]}
    for i, sn in enumerate(new, start=1):
        it = lookup[sn]
        new_items.append({
            "set_num": it["set_num"],
            "note": it.get("note"),
            "position": i,
            "added_at": it["added_at"],
        })
    l["items"] = new_items
    l["updated_at"] = datetime.utcnow()
    return l