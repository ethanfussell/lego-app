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
    if len(parts) == 2 and parts[0].lower() == "bearer":
        token = parts[1]
    else:
        token = authorization

    username = token
    prefix = "fake-token-for-"
    if token.startswith(prefix):
        username = token[len(prefix):]

    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    # mimic a user object
    return SimpleNamespace(username=username)


# ---------- Pydantic models ----------

class ListCreate(BaseModel):
    title: str
    description: Optional[str] = None
    is_public: bool = True


class ListDetail(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    is_public: bool = True
    owner: str
    items: TypingList[str] = []
    items_count: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True  # Pydantic v2 replacement for orm_mode


class ListItemCreate(BaseModel):
    set_num: str


# ---------- In-memory store ----------

LISTS: TypingList[Dict[str, Any]] = []
NEXT_LIST_ID: int = 1


def _to_detail_dict(raw: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize our internal dict into the shape ListDetail expects."""
    items = raw.get("items") or []
    return {
        "id": raw["id"],
        "title": raw["title"],
        "description": raw.get("description"),
        "is_public": raw.get("is_public", True),
        "owner": raw["owner"],
        "items": items,
        "items_count": len(items),
        "created_at": raw["created_at"],
        "updated_at": raw["updated_at"],
    }


# ---------- Public lists ----------

@router.get("/public", response_model=TypingList[ListDetail])
def get_public_lists() -> TypingList[ListDetail]:
    public_lists = [lst for lst in LISTS if lst.get("is_public", True)]
    return [_to_detail_dict(lst) for lst in public_lists]


# ---------- My lists (requires auth) ----------

@router.get("/me", response_model=TypingList[ListDetail])
def get_my_lists(current_user=Depends(get_current_user)) -> TypingList[ListDetail]:
    username = current_user.username
    my_lists = [lst for lst in LISTS if lst.get("owner") == username]
    return [_to_detail_dict(lst) for lst in my_lists]


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

    now = datetime.utcnow()
    new_list = {
        "id": NEXT_LIST_ID,
        "title": payload.title,
        "description": payload.description,
        "is_public": payload.is_public,
        "owner": current_user.username,
        "items": [],
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
    """
    POST /lists/{list_id}/items
    Body: { "set_num": "75395-1" }
    Only the owner can modify their list.
    """
    for lst in LISTS:
        if lst["id"] == list_id:
            if lst.get("owner") != current_user.username:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not own this list",
                )

            items = lst.setdefault("items", [])

            if payload.set_num in items:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Set already in list",
                )

            items.append(payload.set_num)
            lst["updated_at"] = datetime.utcnow()
            return {"ok": True, "items_count": len(items)}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")


# ---------- Remove item from list (requires owner) ----------

@router.delete("/{list_id}/items/{set_num}", status_code=status.HTTP_200_OK)
def remove_list_item(
    list_id: int,
    set_num: str,
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    """
    DELETE /lists/{list_id}/items/{set_num}
    """
    for lst in LISTS:
        if lst["id"] == list_id:
            if lst.get("owner") != current_user.username:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="You do not own this list",
                )

            items = lst.setdefault("items", [])
            if set_num not in items:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Set not in list",
                )

            items.remove(set_num)
            lst["updated_at"] = datetime.utcnow()
            return {"ok": True, "items_count": len(items)}

    raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="List not found")