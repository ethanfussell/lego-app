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
    items = raw.get("items")
    if not isinstance(items, list):
        items = []

    return {
        "id": int(raw["id"]),
        "title": raw.get("title") or "",
        "description": raw.get("description"),
        "is_public": bool(raw.get("is_public", True)),
        "owner": raw.get("owner") or "",
        "items": list(items),  # always present
        "items_count": len(items),
        "position": int(raw.get("position", 0) or 0),
        "is_system": bool(raw.get("is_system", False)),
        "system_key": raw.get("system_key"),
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


def _next_id() -> int:
    global NEXT_LIST_ID
    nid = NEXT_LIST_ID
    NEXT_LIST_ID += 1
    return nid


def _system_list_for(owner: str, system_key: str) -> Optional[Dict[str, Any]]:
    for l in LISTS:
        if l.get("owner") == owner and bool(l.get("is_system", False)) and l.get("system_key") == system_key:
            return l
    return None


def _create_system_list(owner: str, system_key: str, title: str) -> Dict[str, Any]:
    now = _now()
    new_list = {
        "id": _next_id(),
        "title": title,
        "description": None,
        "is_public": False,  # pinned private (and we also block updates)
        "owner": owner,
        "items": [],
        "position": 0,  # will be normalized
        "is_system": True,
        "system_key": system_key,  # "owned" or "wishlist"
        "created_at": now,
        "updated_at": now,
    }
    LISTS.append(new_list)
    return new_list


def _normalize_positions_for_owner(owner: str) -> None:
    """
    Force: Owned = 0, Wishlist = 1, then custom lists start at 2.
    """
    owned = _system_list_for(owner, "owned")
    wishlist = _system_list_for(owner, "wishlist")

    # custom lists sorted by current position (stable)
    custom = [l for l in LISTS if l.get("owner") == owner and not bool(l.get("is_system", False))]
    custom.sort(key=lambda x: int(x.get("position", 0) or 0))

    now = _now()

    if owned:
        owned["position"] = 0
        owned["updated_at"] = now
    if wishlist:
        wishlist["position"] = 1
        wishlist["updated_at"] = now

    for i, l in enumerate(custom, start=2):
        l["position"] = i
        l["updated_at"] = now


def _ensure_system_lists(owner: str) -> None:
    if not _system_list_for(owner, "owned"):
        _create_system_list(owner, "owned", "Owned")
    if not _system_list_for(owner, "wishlist"):
        _create_system_list(owner, "wishlist", "Wishlist")

    _normalize_positions_for_owner(owner)


# ----------------------------
# Read APIs
# ----------------------------

def get_public_lists() -> List[Dict[str, Any]]:
    public_lists = [lst for lst in LISTS if bool(lst.get("is_public", True))]
    public_lists.sort(key=lambda x: (x.get("owner", ""), int(x.get("position", 0) or 0)))
    return [_to_detail_dict(lst) for lst in public_lists]


def get_my_lists(owner: str, include_system: bool = True) -> List[Dict[str, Any]]:
    _ensure_system_lists(owner)

    mine = [
        lst
        for lst in LISTS
        if lst.get("owner") == owner and (include_system or not bool(lst.get("is_system", False)))
    ]
    mine.sort(key=lambda x: int(x.get("position", 0) or 0))
    return [_to_detail_dict(lst) for lst in mine]


def get_list_detail(list_id: int) -> Dict[str, Any]:
    lst = _get_list_or_error(list_id)
    return _to_detail_dict(lst)


# ----------------------------
# Write APIs
# ----------------------------

def create_list(owner: str, title: str, description: Optional[str], is_public: bool) -> Dict[str, Any]:
    clean_title = (title or "").strip()
    if not clean_title:
        raise ListsDataError(422, "title_required")

    _ensure_system_lists(owner)

    now = _now()
    new_list = {
        "id": _next_id(),
        "title": clean_title,
        "description": (description.strip() if description else None),
        "is_public": bool(is_public),
        "owner": owner,
        "items": [],
        "position": 999999,  # normalize will place after system/custom
        "is_system": False,
        "system_key": None,
        "created_at": now,
        "updated_at": now,
    }

    LISTS.append(new_list)
    _normalize_positions_for_owner(owner)
    return _to_detail_dict(new_list)


def add_list_item(owner: str, list_id: int, set_num: str) -> Dict[str, Any]:
    clean = (set_num or "").strip()
    if not clean:
        raise ListsDataError(422, "set_num_required")

    lst = _get_list_or_error(list_id)
    _ensure_owner(lst, owner)

    items = lst.setdefault("items", [])
    if not isinstance(items, list):
        items = []
        lst["items"] = items

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
    if not isinstance(items, list):
        items = []
        lst["items"] = items

    if clean not in items:
        raise ListsDataError(404, "set_not_in_list")

    items.remove(clean)
    lst["updated_at"] = _now()
    return {"ok": True, "items_count": len(items)}


def reorder_my_lists(owner: str, ordered_ids: List[int]) -> List[Dict[str, Any]]:
    """
    Reorder CUSTOM lists only (not Owned/Wishlist system lists).
    Frontend can keep sending only custom list ids.
    """
    _ensure_system_lists(owner)

    custom = [lst for lst in LISTS if lst.get("owner") == owner and not bool(lst.get("is_system", False))]
    custom_ids = [int(lst["id"]) for lst in custom]

    if len(ordered_ids) != len(custom_ids):
        raise ListsDataError(400, "ordered_ids_must_include_all_custom")

    if sorted([int(x) for x in ordered_ids]) != sorted(custom_ids):
        raise ListsDataError(400, "ordered_ids_must_match_all_custom")

    by_id = {int(lst["id"]): lst for lst in custom}
    now = _now()

    # assign temporary positions; normalize will pin system at 0/1 and custom starting at 2
    for pos, list_id in enumerate(ordered_ids):
        by_id[int(list_id)]["position"] = 2 + pos
        by_id[int(list_id)]["updated_at"] = now

    _normalize_positions_for_owner(owner)

    mine = [lst for lst in LISTS if lst.get("owner") == owner and not bool(lst.get("is_system", False))]
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

    # Optional: block editing system lists
    if bool(lst.get("is_system", False)):
        raise ListsDataError(400, "cannot_update_system_list")

    changed = False

    if title is not None:
        clean_title = (title or "").strip()
        if not clean_title:
            raise ListsDataError(422, "title_required")
        lst["title"] = clean_title
        changed = True

    if description is not None:
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

    if bool(lst.get("is_system", False)):
        raise ListsDataError(400, "cannot_delete_system_list")

    LISTS.remove(lst)
    _normalize_positions_for_owner(owner)
    return {"ok": True}