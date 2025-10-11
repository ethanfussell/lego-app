from fastapi import APIRouter, HTTPException, Query, status
from typing import Optional, List
from app.data.sets import SETS
from app.schemas.lego_set import LegoSet, LegoSetCreate

router = APIRouter()

@router.get("/", response_model=List[LegoSet])
def list_sets(
    q: Optional[str] = Query(None, description="Search text (matches name)"),
    theme: Optional[str] = Query(None, description="Filter by theme"),
    year: Optional[int] = Query(None, description="Filter by year"),
):
    items = SETS
    if q:
        ql = q.lower()
        items = [s for s in items if ql in s["name"].lower()]
    if theme:
        items = [s for s in items if s.get("theme") == theme]
    if year is not None:
        items = [s for s in items if s.get("year") == year]
    return items

@router.get("/{set_num}", response_model=LegoSet)
def get_set(set_num: str):
    for s in SETS:
        if s["set_num"] == set_num:
            return s
    raise HTTPException(status_code=404, detail="Set not found")

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=LegoSet)
def create_set(payload: LegoSetCreate):
    # prevent duplicates by set_num
    if any(s["set_num"] == payload.set_num for s in SETS):
        raise HTTPException(status_code=400, detail="Set number already exists")

    obj = payload.model_dump()  # dict
    SETS.append(obj)
    return obj

@router.delete("/{set_num}", status_code=status.HTTP_204_NO_CONTENT)
def delete_set(set_num: str):
    """
    Remove a set by set_num.
    Returns 204 on success, 404 if not found.
    """
    # Find the index of the item to delete
    idx = next((i for i, s in enumerate(SETS) if s["set_num"] == set_num), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Set not found")

    # Remove it from our in-memory list
    del SETS[idx]
    # 204 No Content: nothing else to return
    return