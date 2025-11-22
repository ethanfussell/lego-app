# app/routers/collections.py
from fastapi import APIRouter, HTTPException, Query, status
from typing import List
from datetime import datetime

from app.data.custom_collections import OWNED, WISHLIST
from app.data.sets import get_set_by_num
from app.schemas.collection import CollectionCreate, CollectionItem

router = APIRouter()

# -------- helpers --------
def _set_exists(set_num: str) -> bool:
    # accepts "10305" or "10305-1"
    return get_set_by_num(set_num) is not None

def _has_item(store: List[dict], username: str, set_num: str) -> bool:
    return any(i for i in store if i["username"] == username and i["set_num"] == set_num)

def _remove_item(store: List[dict], username: str, set_num: str) -> bool:
    for idx, i in enumerate(store):
        if i["username"] == username and i["set_num"] == set_num:
            del store[idx]
            return True
    return False

# -------- Owned --------
@router.post("/collections/owned", status_code=status.HTTP_201_CREATED, response_model=CollectionItem)
def add_owned(payload: CollectionCreate):
    if not _set_exists(payload.set_num):
        raise HTTPException(status_code=404, detail="Set not found")
    if _has_item(OWNED, payload.username, payload.set_num):
        raise HTTPException(status_code=400, detail="Already in owned")
    item = {
        "username": payload.username,
        "set_num": payload.set_num,
        "type": "owned",
        "created_at": datetime.utcnow(),
    }
    OWNED.append(item)
    # optional: ensure it's not lingering in wishlist
    _remove_item(WISHLIST, payload.username, payload.set_num)
    return item

@router.delete("/collections/owned/{set_num}", status_code=status.HTTP_204_NO_CONTENT)
def remove_owned(
    set_num: str,
    username: str = Query(..., description="Username to remove from owned"),
):
    if not _remove_item(OWNED, username, set_num):
        raise HTTPException(status_code=404, detail="Not in owned")
    return

# -------- Wishlist --------
@router.post("/collections/wishlist", status_code=status.HTTP_201_CREATED, response_model=CollectionItem)
def add_wishlist(payload: CollectionCreate):
    if not _set_exists(payload.set_num):
        raise HTTPException(status_code=404, detail="Set not found")
    if _has_item(WISHLIST, payload.username, payload.set_num):
        raise HTTPException(status_code=400, detail="Already in wishlist")
    item = {
        "username": payload.username,
        "set_num": payload.set_num,
        "type": "wishlist",
        "created_at": datetime.utcnow(),
    }
    WISHLIST.append(item)
    return item

@router.delete("/collections/wishlist/{set_num}", status_code=status.HTTP_204_NO_CONTENT)
def remove_wishlist(
    set_num: str,
    username: str = Query(..., description="Username to remove from wishlist"),
):
    if not _remove_item(WISHLIST, username, set_num):
        raise HTTPException(status_code=404, detail="Not in wishlist")
    return

# -------- Listing by user --------
@router.get("/users/{username}/owned", response_model=List[CollectionItem])
def list_owned(username: str):
    return [i for i in OWNED if i["username"] == username]

@router.get("/users/{username}/wishlist", response_model=List[CollectionItem])
def list_wishlist(username: str):
    return [i for i in WISHLIST if i["username"] == username]