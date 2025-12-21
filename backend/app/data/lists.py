# backend/app/data/lists.py
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional


# In-memory store (temporary until DB)
LISTS: List[Dict[str, Any]] = []
NEXT_LIST_ID: int = 1


class ListsDataError(Exception):
    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def _now() -> datetime:
    return datetime.utcnow()


def _to_detail_dict(raw: Dict[str, Any]) -> Dict[str, Any]:
    items = raw.get("items") or []
    return {
        "id": int(raw["id"]),
        "title": raw["title"],
        "description": raw.get("description"),
        "is_public": bool(raw.get("is_public", True)),
        "owner": raw["owner"],
        "items": list(items),
        "items_count": len(items),
        "position": int(raw.get("position", 0) or 0),
        "created_at": raw["created_at"],
        "updated_at": raw["updated_at"],
    }


def _get_list_raw(list_id: int) -> Optional[Dict[str, Any]]:
    for lst in LISTS:
        if int(lst.get("id", -1)) == int(list_id):
            return lst
    return None


def _get_list_or_error(list_id: int) -> Dict[str, Any]:
    lst = _get_list_raw(list_id)
    if not lst:
        raise ListsDataError(404, "list_not_found")
    return lst


def _ensure_owner(lst: Dict[str, Any], owner: str) -> None:
    if lst.get("owner") != owner:
        raise ListsDataError(403, "not_owner")


def _next_position_for_owner(owner: str) -> int:
    positions = [int(l.get("position", 0) or 0) for l in LISTS if l.get("owner") == owner]
    return (max(positions) + 1) if positions else 0


def _repack_positions_for_owner(owner: str) -> None:
    mine = [x for x in LISTS if x.get("owner") == owner]
    mine.sort(key=lambda x: int(x.get("position", 0) or 0))
    now = _now()
    for i, x in enumerate(mine):
        x["position"] = i
        x["updated_at"] = now


# ----------------------------
# Read APIs
# ----------------------------

def get_public_lists() -> List[Dict[str, Any]]:
    public_lists = [lst for lst in LISTS if bool(lst.get("is_public", True))]
    public_lists.sort(key=lambda x: (x.get("owner", ""), int(x.get("position", 0) or 0)))
    return [_to_detail_dict(lst) for lst in public_lists]


def get_my_lists(owner: str) -> List[Dict[str, Any]]:
    mine = [lst for lst in LISTS if lst.get("owner") == owner]
    mine.sort(key=lambda x: int(x.get("position", 0) or 0))
    return [_to_detail_dict(lst) for lst in mine]


def get_list_detail(list_id: int) -> Dict[str, Any]:
    lst = _get_list_or_error(list_id)
    return _to_detail_dict(lst)


# ----------------------------
# Write APIs
# ----------------------------

def create_list(owner: str, title: str, description: Optional[str], is_public: bool) -> Dict[str, Any]:
    global NEXT_LIST_ID

    clean_title = (title or "").strip()
    if not clean_title:
        raise ListsDataError(422, "title_required")

    now = _now()
    new_list = {
        "id": NEXT_LIST_ID,
        "title": clean_title,
        "description": (description.strip() if description else None),
        "is_public": bool(is_public),
        "owner": owner,
        "items": [],
        "position": _next_position_for_owner(owner),
        "created_at": now,
        "updated_at": now,
    }

    LISTS.append(new_list)
    NEXT_LIST_ID += 1
    return _to_detail_dict(new_list)


def add_list_item(owner: str, list_id: int, set_num: str) -> Dict[str, Any]:
    clean = (set_num or "").strip()
    if not clean:
        raise ListsDataError(422, "set_num_required")

    lst = _get_list_or_error(list_id)
    _ensure_owner(lst, owner)

    items = lst.setdefault("items", [])
    if clean in items:
        raise ListsDataError(409, "set_already_in_list")

    items.append(clean)
    lst["updated_at"] = _now()
    return {"ok": True, "items_count": len(items)}


def remove_list_item(owner: str, list_id: int, set_num: str) -> Dict[str, Any]:
    clean = (set_num or "").strip()
    if not clean:
        raise ListsDataError(422, "set_num_required")

    lst = _get_list_or_error(list_id)
    _ensure_owner(lst, owner)

    items = lst.setdefault("items", [])
    if clean not in items:
        raise ListsDataError(404, "set_not_in_list")

    items.remove(clean)
    lst["updated_at"] = _now()
    return {"ok": True, "items_count": len(items)}


def reorder_my_lists(owner: str, ordered_ids: List[int]) -> List[Dict[str, Any]]:
    mine = [lst for lst in LISTS if lst.get("owner") == owner]
    mine_ids = [int(lst["id"]) for lst in mine]

    if len(ordered_ids) != len(mine_ids):
        raise ListsDataError(400, "ordered_ids_must_include_all")

    if sorted([int(x) for x in ordered_ids]) != sorted(mine_ids):
        raise ListsDataError(400, "ordered_ids_must_match_all")

    by_id = {int(lst["id"]): lst for lst in mine}
    now = _now()

    for pos, list_id in enumerate(ordered_ids):
        by_id[int(list_id)]["position"] = pos
        by_id[int(list_id)]["updated_at"] = now

    mine.sort(key=lambda x: int(x.get("position", 0) or 0))
    return [_to_detail_dict(lst) for lst in mine]


def update_list(
    owner: str,
    list_id: int,
    title: Optional[str] = None,
    description: Optional[str] = None,
    is_public: Optional[bool] = None,
) -> Dict[str, Any]:
    lst = _get_list_raw(list_id)
    if not lst:
        raise ListsDataError(404, "list_not_found")

    _ensure_owner(lst, owner)

    changed = False

    if title is not None:
        clean_title = (title or "").strip()
        if not clean_title:
            raise ListsDataError(422, "title_required")
        lst["title"] = clean_title
        changed = True

    if description is not None:
        # allow clearing description by sending "" or null-ish
        clean_desc = (description or "").strip() or None
        lst["description"] = clean_desc
        changed = True

    if is_public is not None:
        lst["is_public"] = bool(is_public)
        changed = True

    if changed:
        lst["updated_at"] = _now()

    return _to_detail_dict(lst)


def delete_list(owner: str, list_id: int) -> Dict[str, Any]:
    lst = _get_list_raw(list_id)
    if not lst:
        raise ListsDataError(404, "list_not_found")

    _ensure_owner(lst, owner)

    LISTS.remove(lst)

    # re-pack positions 0..n-1 for this owner so reorder stays consistent
    mine = [x for x in LISTS if x.get("owner") == owner]
    mine.sort(key=lambda x: int(x.get("position", 0) or 0))
    now = _now()
    for i, x in enumerate(mine):
        x["position"] = i
        x["updated_at"] = now

    return {"ok": True}