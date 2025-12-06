# app/routers/custom_collections.py
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from ..core.auth import User, get_current_user

router = APIRouter()

# -------------------------------
# In-memory store
# Each item: { "username": str, "set_num": str, "type": "owned" | "wishlist" }
# -------------------------------
COLLECTIONS: List[Dict[str, Any]] = []


class CollectionCreate(BaseModel):
    set_num: str


class CollectionItem(BaseModel):
    set_num: str
    type: str  # "owned" or "wishlist"


def _find_item(username: str, set_num: str, type_: str) -> Optional[Dict[str, Any]]:
    for item in COLLECTIONS:
        if (
            item["username"] == username
            and item["set_num"] == set_num
            and item["type"] == type_
        ):
            return item
    return None


def _list_items(username: str, type_: str) -> List[CollectionItem]:
    return [
        CollectionItem(set_num=item["set_num"], type=item["type"])
        for item in COLLECTIONS
        if item["username"] == username and item["type"] == type_
    ]


# -------------------------------
# GET current user's owned / wishlist
# -------------------------------
@router.get("/me/owned", response_model=List[CollectionItem])
def get_my_owned(current_user: User = Depends(get_current_user)) -> List[CollectionItem]:
    return _list_items(current_user.username, "owned")


@router.get("/me/wishlist", response_model=List[CollectionItem])
def get_my_wishlist(current_user: User = Depends(get_current_user)) -> List[CollectionItem]:
    return _list_items(current_user.username, "wishlist")


# -------------------------------
# POST add to owned / wishlist
# -------------------------------
@router.post(
    "/owned",
    response_model=CollectionItem,
    status_code=status.HTTP_201_CREATED,
)
def add_owned(
    payload: CollectionCreate,
    current_user: User = Depends(get_current_user),
) -> CollectionItem:
    username = current_user.username
    existing = _find_item(username, payload.set_num, "owned")
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Set already in owned collection",
        )

    item = {
        "username": username,
        "set_num": payload.set_num,
        "type": "owned",
    }
    COLLECTIONS.append(item)
    return CollectionItem(set_num=item["set_num"], type=item["type"])


@router.post(
    "/wishlist",
    response_model=CollectionItem,
    status_code=status.HTTP_201_CREATED,
)
def add_wishlist(
    payload: CollectionCreate,
    current_user: User = Depends(get_current_user),
) -> CollectionItem:
    username = current_user.username
    existing = _find_item(username, payload.set_num, "wishlist")
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Set already in wishlist",
        )

    item = {
        "username": username,
        "set_num": payload.set_num,
        "type": "wishlist",
    }
    COLLECTIONS.append(item)
    return CollectionItem(set_num=item["set_num"], type=item["type"])


# -------------------------------
# DELETE from owned / wishlist
# -------------------------------
@router.delete("/owned/{set_num}", status_code=status.HTTP_204_NO_CONTENT)
def remove_owned(
    set_num: str,
    current_user: User = Depends(get_current_user),
) -> None:
    username = current_user.username
    for idx, item in enumerate(COLLECTIONS):
        if (
            item["username"] == username
            and item["set_num"] == set_num
            and item["type"] == "owned"
        ):
            del COLLECTIONS[idx]
            return
    # 204 even if it wasn't there is fine


@router.delete("/wishlist/{set_num}", status_code=status.HTTP_204_NO_CONTENT)
def remove_wishlist(
    set_num: str,
    current_user: User = Depends(get_current_user),
) -> None:
    username = current_user.username
    for idx, item in enumerate(COLLECTIONS):
        if (
            item["username"] == username
            and item["set_num"] == set_num
            and item["type"] == "wishlist"
        ):
            del COLLECTIONS[idx]
            return
    # same: 204 either way