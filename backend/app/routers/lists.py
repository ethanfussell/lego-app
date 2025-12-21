# backend/app/routers/lists.py
from typing import Any, Dict, List as TypingList
from types import SimpleNamespace

from fastapi import APIRouter, Depends, Header, HTTPException, status


from app.schemas.list import ListCreate, ListDetail, ListItemCreate, ListOrderUpdate, ListUpdate
from app.data.lists import (
    ListsDataError,
    add_list_item,
    create_list,
    delete_list,
    get_list_detail,
    get_my_lists,
    get_public_lists,
    remove_list_item,
    reorder_my_lists,
    update_list,
)

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


def _handle_data_error(e: ListsDataError) -> None:
    # Convert your data-layer error into an HTTP response
    raise HTTPException(status_code=e.status_code, detail=e.detail)


# ---------- Public lists ----------
@router.get("/public", response_model=TypingList[ListDetail])
def api_get_public_lists() -> TypingList[ListDetail]:
    return get_public_lists()


# ---------- My lists (requires auth) ----------
@router.get("/me", response_model=TypingList[ListDetail])
def api_get_my_lists(current_user=Depends(get_current_user)) -> TypingList[ListDetail]:
    return get_my_lists(current_user.username)


# ---------- Reorder my lists (requires auth) ----------
@router.put("/me/order", response_model=TypingList[ListDetail])
def api_reorder_my_lists(
    payload: ListOrderUpdate,
    current_user=Depends(get_current_user),
) -> TypingList[ListDetail]:
    try:
        return reorder_my_lists(current_user.username, payload.ordered_ids)
    except ListsDataError as e:
        _handle_data_error(e)


# ---------- Single list detail (view only) ----------
@router.get("/{list_id}", response_model=ListDetail)
def api_get_list_detail(list_id: int) -> ListDetail:
    try:
        return get_list_detail(list_id)
    except ListsDataError as e:
        _handle_data_error(e)


# ---------- Create list (requires auth) ----------
@router.post("", response_model=ListDetail, status_code=status.HTTP_201_CREATED)
def api_create_list(
    payload: ListCreate,
    current_user=Depends(get_current_user),
) -> ListDetail:
    try:
        return create_list(
            owner=current_user.username,
            title=payload.title,
            description=payload.description,
            is_public=payload.is_public,
        )
    except ListsDataError as e:
        _handle_data_error(e)


# ---------- Add item to list (requires owner) ----------
@router.post("/{list_id}/items", status_code=status.HTTP_201_CREATED)
def api_add_list_item(
    list_id: int,
    payload: ListItemCreate,
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        return add_list_item(
            owner=current_user.username,
            list_id=list_id,
            set_num=payload.set_num,
        )
    except ListsDataError as e:
        _handle_data_error(e)


# ---------- Remove item from list (requires owner) ----------
@router.delete("/{list_id}/items/{set_num}", status_code=status.HTTP_200_OK)
def api_remove_list_item(
    list_id: int,
    set_num: str,
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        return remove_list_item(
            owner=current_user.username,
            list_id=list_id,
            set_num=set_num,
        )
    except ListsDataError as e:
        _handle_data_error(e)


@router.delete("/{list_id}", status_code=status.HTTP_200_OK)
def api_delete_list(list_id: int, current_user=Depends(get_current_user)) -> Dict[str, Any]:
    try:
        return delete_list(owner=current_user.username, list_id=list_id)
    except ListsDataError as e:
        _handle_data_error(e)


@router.patch("/{list_id}", response_model=ListDetail)
def api_update_list(
    list_id: int,
    payload: ListUpdate,
    current_user=Depends(get_current_user),
) -> ListDetail:
    try:
        return update_list(
            owner=current_user.username,
            list_id=list_id,
            title=payload.title,
            description=payload.description,
            is_public=payload.is_public,
        )
    except ListsDataError as e:
        _handle_data_error(e)


@router.delete("/{list_id}", status_code=status.HTTP_200_OK)
def api_delete_list(
    list_id: int,
    current_user=Depends(get_current_user),
) -> Dict[str, Any]:
    try:
        return delete_list(owner=current_user.username, list_id=list_id)
    except ListsDataError as e:
        _handle_data_error(e)