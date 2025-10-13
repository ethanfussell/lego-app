from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query, status, Response
from pydantic import conint
from app.data.sets import SETS
from app.schemas.lego_set import LegoSet, LegoSetCreate, LegoSetUpdate
from app.data.reviews_stats import rating_stats_for_set

router = APIRouter()

import re

def _s(val) -> str:
    return str(val if val is not None else "").lower()

_token_re = re.compile(r"\S+")

def _parse_tokens(q: str):
    """
    Split query into text tokens and optional numeric filters like 4000+
    Returns: (tokens: list[str], filters: dict)
    """
    if not q:
        return [], {}
    tokens = [t.lower() for t in _token_re.findall(q)]
    filt = {}
    for t in tokens[:]:  # iterate over a copy so we can remove filter tokens
        m = re.fullmatch(r"(\d{3,5})\+", t)  # e.g., 4000+
        if m:
            filt["piece_min"] = int(m.group(1))
            tokens.remove(t)
    return tokens, filt

def _matches_any_field(s: dict, tok: str) -> bool:
    fields = [
        _s(s.get("name")),
        _s(s.get("set_num")),
        _s(s.get("theme")),
        _s(s.get("year")),
    ]
    return any(tok in f for f in fields)

def _all_tokens_match(s: dict, tokens: list[str]) -> bool:
    return all(_matches_any_field(s, tok) for tok in tokens)

def _score_relevance(s: dict, tokens: list[str]) -> tuple:
    """Higher is better; simple weighted signals for relevance."""
    name = _s(s.get("name"))
    set_num = _s(s.get("set_num"))
    theme = _s(s.get("theme"))
    year = _s(s.get("year"))

    exact_set = sum(1 for t in tokens if t == set_num)
    name_starts = sum(1 for t in tokens if name.startswith(t))
    name_contains = sum(1 for t in tokens if t in name)
    theme_contains = sum(1 for t in tokens if t in theme)
    year_exact = sum(1 for t in tokens if t == year)

    score = (
        exact_set * 1000
        + name_starts * 50
        + name_contains * 20
        + theme_contains * 10
        + year_exact * 30
    )
    return (score, s.get("pieces") or 0, name)
# ==== END SEARCH HELPERS ====

def _field(val):  # already added earlier for search helpers
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
    return all(any(tok in f for f in fields) for tok in tokens)

@router.get("/", response_model=List[LegoSet])
def list_sets(
    q: Optional[str] = Query(None, description="Search by name, set number, theme, piece count, or year"),
    sort: Optional[str] = Query(None, description="rating | pieces | year | name | relevance"),
    order: Optional[str] = Query(None, description="ascending | descending"),
    page: conint(ge=1) = Query(1, description="Page number (1-based)"),
    limit: conint(ge=1, le=100) = Query(10, description="Page size (1–100)"),
    response: Response = None,
):
    items = SETS

    # --- universal search parsing ---
    tokens, extra_filters = _parse_tokens(q or "")

    # text tokens (multi-word, partial) across name/set_num/theme/year
    if tokens:
        items = [s for s in items if _all_tokens_match(s, tokens)]

    # numeric convenience filter (e.g., '4000+')
    piece_min = extra_filters.get("piece_min")
    if piece_min is not None:
        items = [s for s in items if (s.get("pieces") or 0) >= piece_min]

    # --- sorting: default to relevance if no explicit sort ---
    allowed = {"rating", "pieces", "year", "name", "relevance", None}
    if sort not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid sort '{sort}'. Allowed: rating, pieces, year, name, relevance")

    if sort is None:
        sort = "relevance"  # default
    if order is None:
        order = "desc" if sort in {"rating", "pieces", "year", "relevance"} else "asc"
    reverse = order == "desc"

    if sort == "rating":
        def rating_key(s):
            avg, count = rating_stats_for_set(s["set_num"])
            return (avg, count, _s(s.get("name")))
        items = sorted(items, key=rating_key, reverse=reverse)
    elif sort == "pieces":
        items = sorted(items, key=lambda s: (s.get("pieces") is None, s.get("pieces") or 0, _s(s.get("name"))), reverse=reverse)
    elif sort == "year":
        items = sorted(items, key=lambda s: (s.get("year") is None, s.get("year") or 0, _s(s.get("name"))), reverse=reverse)
    elif sort == "name":
        items = sorted(items, key=lambda s: _s(s.get("name")), reverse=reverse)
    elif sort == "relevance":
        # Only meaningful when tokens exist; otherwise falls back to a stable name sort feel
        if tokens:
            items = sorted(items, key=lambda s: _score_relevance(s, tokens), reverse=True)
        else:
            items = sorted(items, key=lambda s: _s(s.get("name")))

    # --- enrichment (ratings) ---
    enriched = []
    for s in items:
        avg, count = rating_stats_for_set(s["set_num"])
        enriched.append({**s, "rating_avg": avg, "rating_count": count})

    # --- pagination ---
    total = len(enriched)
    start = (page - 1) * limit
    end = start + limit
    page_items = enriched[start:end]

    if response is not None:
        response.headers["X-Total-Count"] = str(total)

    return page_items
    
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