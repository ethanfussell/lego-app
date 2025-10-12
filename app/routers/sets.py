from fastapi import APIRouter, HTTPException, Query, status
from typing import Optional, List
from app.data.sets import SETS
from app.schemas.lego_set import LegoSet, LegoSetCreate, LegoSetUpdate
from app.data.reviews_stats import rating_stats_for_set

router = APIRouter()

def _matches_query(s: dict, q: str) -> bool:
    if not q:
        return True
    tokens = [t.strip().lower() for t in q.split() if t.strip()]
    # Build a simple “haystack” of fields we want to search
    fields = [
        s.get("name", "").lower(),
        s.get("set_num", "").lower(),
        (s.get("theme") or "").lower(),
        str(s.get("year") or ""),
    ]
    # Every token must appear in at least one field
    return all(any(tok in f for f in fields) for tok in tokens)

def _field(val) -> str:
    # Safely turn any value (including None/int) into a lowercase string
    return str(val or "").lower()

def _matches_query(s: dict, q: str) -> bool:
    if not q:
        return True
    tokens = [t.strip().lower() for t in q.split() if t.strip()]
    fields = [
        _field(s.get("name")),
        _field(s.get("set_num")),
        _field(s.get("theme")),
        _field(s.get("year")),
    ]
    # Every token must appear in at least one field
    return all(any(tok in f for f in fields) for tok in tokens)

@router.get("/", response_model=List[LegoSet])

@router.get("/", response_model=List[LegoSet])
def list_sets(
    q: Optional[str] = Query(None, description="Search across name, set number, theme, or year"),
    theme: Optional[str] = Query(None, description="Filter by theme"),
    year: Optional[int] = Query(None, description="Filter by year"),
    piece_min: Optional[int] = Query(None, description="Minimum piece count"),
    piece_max: Optional[int] = Query(None, description="Maximum piece count"),
):
    items = SETS

    if q:
        items = [s for s in items if _matches_query(s, q)]

    if theme:
        items = [s for s in items if s.get("theme") == theme]
    if year is not None:
        items = [s for s in items if s.get("year") == year]
    if piece_min is not None:
        items = [s for s in items if (s.get("pieces") or 0) >= piece_min]
    if piece_max is not None:
        items = [s for s in items if (s.get("pieces") or 0) <= piece_max]

    enriched = []
    for s in items:
        avg, count = rating_stats_for_set(s["set_num"])
        enriched.append({**s, "rating_avg": avg, "rating_count": count})
    return enriched
    
@router.get("/{set_num}", response_model=LegoSet)
def get_set(set_num: str):
    for s in SETS:
        if s["set_num"] == set_num:
            # include rating stats when returning one set
            avg, count = rating_stats_for_set(s["set_num"])
            return {**s, "rating_avg": avg, "rating_count": count}
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

@router.put("/{set_num}", response_model=LegoSet)
def update_set(set_num: str, payload: LegoSetUpdate):
    """
    Full update (PUT) of a set. set_num is immutable.
    Returns the updated object or 404 if not found.
    """
    # find existing
    idx = next((i for i, s in enumerate(SETS) if s["set_num"] == set_num), None)
    if idx is None:
        raise HTTPException(status_code=404, detail="Set not found")

    # replace with new data, keeping the ID the same
    updated = {
        "set_num": set_num,
        "name": payload.name,
        "pieces": payload.pieces,
        "theme": payload.theme,
        "year": payload.year,
    }
    SETS[idx] = updated
    return updated