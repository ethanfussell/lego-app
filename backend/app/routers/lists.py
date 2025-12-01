# app/routers/lists.py
from fastapi import APIRouter, HTTPException, status, Query, Depends, Body
from typing import Optional, List, Dict, Any
from datetime import datetime, UTC

from ..data.lists import LISTS
from ..data.sets import get_set_by_num, load_cached_sets
from ..schemas.list import (
    ListCreate,
    ListUpdate,
    ListSummary,
    UserList,
    ListItemCreate,
    ReorderPayload,
)

# 🔐 auth
from ..core.auth import User, get_current_user

router = APIRouter()

# -------------------------------------------------------
# Helpers
# -------------------------------------------------------

# small in-process index (optional) to speed up lookups
try:
    _SET_INDEX: Dict[str, Dict[str, Any]] = {s["set_num"]: s for s in load_cached_sets()}
except Exception:
    _SET_INDEX = {}


def _lookup_set(set_num: str) -> Optional[Dict[str, Any]]:
    """Accepts '10305' or '10305-1'. Tries cache index, then get_set_by_num()."""
    s = _SET_INDEX.get(set_num)
    if s:
        return s
    s = get_set_by_num(set_num)
    if s:
        _SET_INDEX[set_num] = s
        return s
    # If a plain number like '10305' was passed, try to find first '-1' match
    if "-" not in set_num:
        dashed = get_set_by_num(f"{set_num}-1")
        if dashed:
            _SET_INDEX[f"{set_num}-1"] = dashed
            return dashed
    return None


def _set_exists(set_num: str) -> bool:
    return _lookup_set(set_num) is not None


def _next_list_id() -> int:
    return max((l["id"] for l in LISTS), default=0) + 1


def _get_list(list_id: int) -> Optional[dict]:
    for l in LISTS:
        if l["id"] == list_id:
            return l
    return None


def _ensure_owner(l: dict, user: str):
    if l["owner"] != user:
        raise HTTPException(
            status_code=403,
            detail="Only the owner can modify this list",
        )


def _summarize(l: dict) -> dict:
    """
    Normalize a list dict into the shape expected by ListSummary.

    Tests (and the schema) expect:
    - name
    - items_count

    We can also include title/count as extras if we want; the response
    model will ignore unknown fields.
    """
    items_count = len(l.get("items", []))

    return {
        "id": l["id"],
        "name": l["title"],          # ✅ what the schema/tests expect
        "owner": l["owner"],
        "is_public": l.get("is_public", True),
        "items_count": items_count,  # ✅ what the schema/tests expect

        # extra fields (harmless if the model ignores them)
        "title": l["title"],
        "count": items_count,
        "created_at": l["created_at"],
        "updated_at": l["updated_at"],
        "description": l.get("description", None),
    }

def _now_utc():
    return datetime.now(UTC)


def _enrich_items(items: List[dict]) -> List[dict]:
    """Attach basic set metadata to each item if available."""
    out: List[dict] = []
    for it in items:
        s = _lookup_set(it["set_num"])
        enriched = dict(it)
        if s:
            enriched.update(
                {
                    "name": s.get("name"),
                    "year": s.get("year"),
                    "theme": s.get("theme"),
                    "image_url": s.get("image_url"),
                    "pieces": s.get("pieces"),
                }
            )
        out.append(enriched)
    return out


# -------------------------------------------------------
# Routes
# -------------------------------------------------------

@router.post("", status_code=status.HTTP_201_CREATED, response_model=UserList)
def create_list(
    payload: ListCreate,
    current_user: User = Depends(get_current_user),
):
    """
    Create a new list. Owner always comes from the logged-in user.
    """
    now = _now_utc()

    l = {
        "id": _next_list_id(),
        "owner": current_user.username,  # ✅ owner from token
        "title": payload.title,
        "description": getattr(payload, "description", None),
        "is_public": getattr(payload, "is_public", True),
        "items": [],
        "created_at": now,
        "updated_at": now,
    }

    LISTS.append(l)

    return {**l, "items": _enrich_items(l["items"])}


@router.get("/users/{username}", response_model=List[ListSummary])
def list_summaries_for_user(username: str):
    """
    All lists owned by a user (summaries). PUBLIC view.
    """
    return [_summarize(l) for l in LISTS if l["owner"] == username]


@router.get("/public", response_model=List[ListSummary])
def list_public_lists(
    owner: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100, description="Max lists to return"),
    offset: int = Query(0, ge=0, description="Skip this many lists"),
):
    """
    Public feed of lists.

    - Only includes lists where is_public=True (or missing → treated as True)
    - Sorted by updated_at (newest first)
    - Optional filter by owner
    - Basic pagination with limit + offset
    """
    lists = [l for l in LISTS if l.get("is_public", True)]

    if owner:
        lists = [l for l in lists if l["owner"] == owner]

    lists.sort(key=lambda l: l["updated_at"], reverse=True)

    sliced = lists[offset : offset + limit]

    return [_summarize(l) for l in sliced]


@router.get("/me", response_model=List[ListSummary])
def list_my_lists(current_user: User = Depends(get_current_user)):
    """
    All lists owned by the *current* logged-in user (summaries).
    Good for a 'My Lists' page in the UI.
    """
    username = current_user.username
    return [_summarize(l) for l in LISTS if l["owner"] == username]


@router.get("/{list_id}", response_model=UserList)
def get_list(list_id: int):
    """Get one list with items (enriched). PUBLIC for now."""
    l = _get_list(list_id)
    if not l:
        raise HTTPException(status_code=404, detail="List not found")
    return {**l, "items": _enrich_items(l.get("items", []))}



@router.patch("/{list_id}", response_model=UserList)
def update_list(
    list_id: int,
    payload: dict = Body(default={}),
    current_user: User = Depends(get_current_user),
):
    """
    Update list metadata (title, description, is_public).

    We accept a generic dict body so tests sending just {"title": "..."}
    (or any subset) work cleanly, and we still enforce ownership via auth.
    """
    l = _get_list(list_id)
    if not l:
        raise HTTPException(status_code=404, detail="List not found")

    _ensure_owner(l, current_user.username)

    title = payload.get("title")
    description = payload.get("description")
    is_public = payload.get("is_public")

    if title is not None:
        l["title"] = title
    if description is not None:
        l["description"] = description
    if is_public is not None:
        l["is_public"] = is_public

    l["updated_at"] = _now_utc()

    return {**l, "items": _enrich_items(l.get("items", []))}

@router.delete("/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list(
    list_id: int,
    current_user: User = Depends(get_current_user),
):
    """Delete a list (owner only)."""
    l = _get_list(list_id)
    if not l:
        raise HTTPException(status_code=404, detail="List not found")

    _ensure_owner(l, current_user.username)

    for idx, obj in enumerate(LISTS):
        if obj["id"] == list_id:
            del LISTS[idx]
            return

    raise HTTPException(status_code=404, detail="List not found")


# ------------- Items -------------


@router.post(
    "/{list_id}/items",
    response_model=UserList,
    status_code=status.HTTP_201_CREATED,
)
def add_item(
    list_id: int,
    payload: ListItemCreate,
    current_user: User = Depends(get_current_user),
):
    """Add a set to a list (validates set exists)."""
    l = _get_list(list_id)
    if not l:
        raise HTTPException(status_code=404, detail="List not found")

    _ensure_owner(l, current_user.username)

    if not _set_exists(payload.set_num):
        raise HTTPException(status_code=404, detail="Set not found")

    items = l.setdefault("items", [])
    if any(it["set_num"] == payload.set_num for it in items):
        raise HTTPException(status_code=400, detail="Set already in list")

    items.append(
        {
            "set_num": payload.set_num,
            "added_at": _now_utc(),
        }
    )
    l["updated_at"] = _now_utc()
    return {**l, "items": _enrich_items(items)}


@router.delete("/{list_id}/items/{set_num}", status_code=status.HTTP_204_NO_CONTENT)
def remove_item(
    list_id: int,
    set_num: str,
    current_user: User = Depends(get_current_user),
):
    """Remove a set from a list."""
    l = _get_list(list_id)
    if not l:
        raise HTTPException(status_code=404, detail="List not found")

    _ensure_owner(l, current_user.username)

    items = l.get("items", [])
    for idx, it in enumerate(items):
        if it["set_num"] == set_num:
            del items[idx]
            l["updated_at"] = _now_utc()
            return

    raise HTTPException(status_code=404, detail="Set not in list")


@router.post("/{list_id}/reorder", response_model=UserList)
def reorder_items(
    list_id: int,
    payload: ReorderPayload,
    current_user: User = Depends(get_current_user),
):
    """
    Reorder a list's items by providing the new order of `set_num`s.
    Any missing/extra set_nums will raise a 400.
    """
    l = _get_list(list_id)
    if not l:
        raise HTTPException(status_code=404, detail="List not found")

    _ensure_owner(l, current_user.username)

    current = l.get("items", [])
    current_nums = [it["set_num"] for it in current]
    new_nums = payload.order

    # Validate exact match of membership
    if set(current_nums) != set(new_nums) or len(current_nums) != len(new_nums):
        raise HTTPException(
            status_code=400,
            detail="Order must contain exactly the current set_nums once each",
        )

    # Rebuild items in the new order, preserving per-item data like added_at
    mapping = {it["set_num"]: it for it in current}
    l["items"] = [mapping[num] for num in new_nums]
    l["updated_at"] = _now_utc()

    return {**l, "items": _enrich_items(l["items"])}
