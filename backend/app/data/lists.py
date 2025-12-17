# backend/app/data/lists.py
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional


# In-memory store (dev only)
LISTS: List[Dict[str, Any]] = []
NEXT_LIST_ID: int = 1


def _now() -> datetime:
    return datetime.utcnow()


def _next_position_for_owner(owner: str) -> int:
    owner_positions = [lst.get("position", 0) for lst in LISTS if lst.get("owner") == owner]
    return (max(owner_positions) + 1) if owner_positions else 0


def list_public() -> List[Dict[str, Any]]:
    """Return all public lists, ordered by (owner, position, updated_at)."""
    public_lists = [lst for lst in LISTS if lst.get("is_public", True)]
    return sorted(
        public_lists,
        key=lambda x: (x.get("owner", ""), x.get("position", 0), x.get("updated_at") or x.get("created_at")),
    )


def list_for_user(owner: str) -> List[Dict[str, Any]]:
    """Return all lists owned by `owner`, ordered by position."""
    mine = [lst for lst in LISTS if lst.get("owner") == owner]
    return sorted(mine, key=lambda x: x.get("position", 0))


def get_list(list_id: int) -> Dict[str, Any]:
    for lst in LISTS:
        if lst.get("id") == list_id:
            return lst
    raise KeyError("list_not_found")


def create_list(owner: str, title: str, description: Optional[str], is_public: bool) -> Dict[str, Any]:
    global NEXT_LIST_ID

    now = _now()
    new_list = {
        "id": NEXT_LIST_ID,
        "title": title,
        "description": description,
        "is_public": bool(is_public),
        "owner": owner,
        "items": [],  # list[str]
        "position": _next_position_for_owner(owner),  # 👈 1a goes here (store layer)
        "created_at": now,
        "updated_at": now,
    }

    LISTS.append(new_list)
    NEXT_LIST_ID += 1
    return new_list


def add_item(owner: str, list_id: int, set_num: str) -> int:
    """
    Add set_num to list.items. Only owner can modify.
    Returns new items_count.
    """
    lst = get_list(list_id)

    if lst.get("owner") != owner:
        raise PermissionError("forbidden")

    items = lst.setdefault("items", [])
    if set_num in items:
        raise ValueError("set_already_in_list")

    items.append(set_num)
    lst["updated_at"] = _now()
    return len(items)


def remove_item(owner: str, list_id: int, set_num: str) -> int:
    """
    Remove set_num from list.items. Only owner can modify.
    Returns new items_count.
    """
    lst = get_list(list_id)

    if lst.get("owner") != owner:
        raise PermissionError("forbidden")

    items = lst.setdefault("items", [])
    if set_num not in items:
        raise KeyError("set_not_in_list")

    items.remove(set_num)
    lst["updated_at"] = _now()
    return len(items)


def reorder_lists(owner: str, ordered_ids: List[int]) -> List[Dict[str, Any]]:
    """
    Reorder ALL of the user's lists by passing an array of ids in the desired order.
    - Must include every list id exactly once.
    Returns the newly ordered list objects.
    """
    mine = [lst for lst in LISTS if lst.get("owner") == owner]
    mine_ids = [lst["id"] for lst in mine]

    if len(ordered_ids) != len(mine_ids):
        raise ValueError("ordered_ids_must_include_all")

    if sorted(ordered_ids) != sorted(mine_ids):
        raise ValueError("ordered_ids_must_match_exactly")

    by_id = {lst["id"]: lst for lst in mine}
    now = _now()

    for pos, lid in enumerate(ordered_ids):
        by_id[lid]["position"] = pos
        by_id[lid]["updated_at"] = now

    return list_for_user(owner)