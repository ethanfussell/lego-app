from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
from app.data.sets import SETS

router = APIRouter()

@router.get("/", response_model=List[Dict[str, Any]])
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

@router.get("/{set_num}", response_model=Dict[str, Any])
def get_set(set_num: str):
    for s in SETS:
        if s["set_num"] == set_num:
            return s
    raise HTTPException(status_code=404, detail="Set not found")