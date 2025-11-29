# app/routers/custom_collections.py
from fastapi import APIRouter, HTTPException, status, Depends
from typing import List
from datetime import datetime

from app.data.custom_collections import OWNED, WISHLIST
from app.data.sets import get_set_by_num
from app.schemas.collection import CollectionCreate, CollectionItem

# 🔐 fake auth helpers
from app.core.auth import User, get_current_user

router = APIRouter()

# -------- helpers --------
def _set_exists(set_num: str) -> bool:
    """
    Accepts either '10305' or '10305-1'. Returns True if the set exists
    in our sets cache/API helper.
    """
    return get_set_by_num(set_num) is not None


def _has_item(store: List[dict], username: str, set_num: str) -> bool:
    """
    True if this username already has this set_num in the given store.
    """
    return any(
        i for i in store
        if i["username"] == username and i["set_num"] == set_num
    )


def _remove_item(store: List[dict], username: str, set_num: str) -> bool:
    """
    Remove a single item from the store. Returns True if something was removed.
    """
    for idx, i in enumerate(store):
        if i["username"] == username and i["set_num"] == set_num:
            del store[idx]
            return True
    return False


# -------- Owned --------
@router.post(
    "/owned",
    status_code=status.HTTP_201_CREATED,
    response_model=CollectionItem,
)
def add_owned(
    payload: CollectionCreate,
    current_user: User = Depends(get_current_user),   # 🔐 who is doing this?
):
    """
    Add a set to the *current user's* Owned collection.

    Final path with prefix → POST /collections/owned
    """
    username = current_user.username  # ignore payload.username

    if not _set_exists(payload.set_num):
        raise HTTPException(status_code=404, detail="Set not found")
    if _has_item(OWNED, username, payload.set_num):
        raise HTTPException(status_code=400, detail="Already in owned")

    item = {
        "username": username,
        "set_num": payload.set_num,
        "type": "owned",
        "created_at": datetime.utcnow(),
    }
    OWNED.append(item)

    # Optional: if it was in wishlist, remove it there
    _remove_item(WISHLIST, username, payload.set_num)

    return item


@router.delete(
    "/owned/{set_num}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_owned(
    set_num: str,
    current_user: User = Depends(get_current_user),   # 🔐 only owner can remove
):
    """
    Remove a set from the *current user's* Owned collection.

    Final path with prefix → DELETE /collections/owned/{set_num}
    """
    username = current_user.username
    if not _remove_item(OWNED, username, set_num):
        raise HTTPException(status_code=404, detail="Not in owned")
    return


# -------- Wishlist --------
@router.post(
    "/wishlist",
    status_code=status.HTTP_201_CREATED,
    response_model=CollectionItem,
)
def add_wishlist(
    payload: CollectionCreate,
    current_user: User = Depends(get_current_user),
):
    """
    Add a set to the *current user's* Wishlist.

    Final path with prefix → POST /collections/wishlist
    """
    username = current_user.username

    if not _set_exists(payload.set_num):
        raise HTTPException(status_code=404, detail="Set not found")
    if _has_item(WISHLIST, username, payload.set_num):
        raise HTTPException(status_code=400, detail="Already in wishlist")

    item = {
        "username": username,
        "set_num": payload.set_num,
        "type": "wishlist",
        "created_at": datetime.utcnow(),
    }
    WISHLIST.append(item)
    return item


@router.delete(
    "/wishlist/{set_num}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_wishlist(
    set_num: str,
    current_user: User = Depends(get_current_user),
):
    """
    Remove a set from the *current user's* Wishlist.

    Final path with prefix → DELETE /collections/wishlist/{set_num}
    """
    username = current_user.username
    if not _remove_item(WISHLIST, username, set_num):
        raise HTTPException(status_code=404, detail="Not in wishlist")
    return


# -------- Listing by user (PUBLIC READ) --------
@router.get("/users/{username}/owned", response_model=List[CollectionItem])
def list_owned(username: str):
    """
    Public view: anyone can see a user's owned sets.

    Final path with prefix → GET /collections/users/{username}/owned
    """
    return [i for i in OWNED if i["username"] == username]


@router.get("/users/{username}/wishlist", response_model=List[CollectionItem])
def list_wishlist(username: str):
    """
    Public view: anyone can see a user's wishlist.

    Final path with prefix → GET /collections/users/{username}/wishlist
    """
    return [i for i in WISHLIST if i["username"] == username]


# -------- "Me" views (current user) --------
@router.get("/me/owned", response_model=List[CollectionItem])
def list_my_owned(current_user: User = Depends(get_current_user)):
    """
    Owned sets for the *current* logged-in user.

    Final path with prefix → GET /collections/me/owned
    """
    username = current_user.username
    return [i for i in OWNED if i["username"] == username]


@router.get("/me/wishlist", response_model=List[CollectionItem])
def list_my_wishlist(current_user: User = Depends(get_current_user)):
    """
    Wishlist sets for the *current* logged-in user.

    Final path with prefix → GET /collections/me/wishlist
    """
    username = current_user.username
    return [i for i in WISHLIST if i["username"] == username]