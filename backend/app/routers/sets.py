# app/routers/sets.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from fastapi import APIRouter, HTTPException, Query, Response

from app.data.sets import load_cached_sets, get_set_by_num

router = APIRouter()


# --------- helpers (local; no circular imports) ---------
def _rating_stats_for_set(set_num: str) -> Tuple[float, int]:
    """
    Compute (avg_rating, count) for a set by set_num from the in-memory REVIEWS list,
    if available. Returns (0.0, 0) if no reviews or if the reviews store isn’t present.
    """
    try:
        # Lazy import avoids circular import at module load time
        from app.data.reviews import REVIEWS  # type: ignore
    except Exception:
        return (0.0, 0)

    rows = [r for r in REVIEWS if (r.get("set_num") or "").lower() == set_num.lower()]
    if not rows:
        return (0.0, 0)

    ratings = [r.get("rating") for r in rows if isinstance(r.get("rating"), (int, float))]
    if not ratings:
        return (0.0, 0)

    avg = sum(ratings) / len(ratings)
    return (round(avg, 2), len(ratings))


def _matches_query(s: Dict[str, Any], q: str) -> bool:
    """Case-insensitive match against name, theme, set_num, set_num_plain."""
    q = q.strip().lower()
    if not q:
        return True
    name = (s.get("name") or "").lower()
    theme = (s.get("theme") or "").lower()
    set_num = (s.get("set_num") or "").lower()
    plain = (s.get("set_num_plain") or "").lower()
    return (q in name) or (q in theme) or (q in set_num) or (q == plain)


def _sort_key(sort: str):
    """
    Return a key function for sorting. For 'rating', we sort by (avg, count).
    """
    if sort == "name":
        return lambda r: (r.get("name") or "").lower()
    if sort == "year":
        return lambda r: (r.get("year") or 0)
    if sort == "pieces":
        return lambda r: (r.get("pieces") or 0)
    if sort == "rating":
        # attach synthetic keys on the fly; caller ensures _rating fields exist
        return lambda r: (r.get("_avg_rating") or 0.0, r.get("_rating_count") or 0)
    # default (name)
    return lambda r: (r.get("name") or "").lower()


# --------- routes ---------
@router.get("")
def list_sets(
    response: Response,
    q: Optional[str] = Query(None, description="Search across name, theme, set number"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
    sort: str = Query("name", description="Sort by: name | year | pieces | rating"),
    order: Optional[str] = Query(None, description="asc | desc (optional; defaults chosen per sort)"),
):
    """
    List sets from the local cache with simple search, sorting, and pagination.
    Also includes rating summary (avg, count) if the reviews store is available.
    """
    sets = load_cached_sets()

    # filter
    if q:
        sets = [s for s in sets if _matches_query(s, q)]

    # enrich with rating stats (only the slice we’ll paginate, for speed)
    # if you want exact global sorting by rating, compute for all first
    enriched: List[Dict[str, Any]] = []
    for s in sets:
        avg, count = _rating_stats_for_set(s.get("set_num") or "")
        s2 = dict(s)
        s2["_avg_rating"] = avg
        s2["_rating_count"] = count
        enriched.append(s2)

    # validate sort
    allowed_sorts = {"name", "year", "pieces", "rating"}
    if sort not in allowed_sorts:
        raise HTTPException(status_code=400, detail=f"Invalid sort '{sort}'. Allowed: {', '.join(sorted(allowed_sorts))}")

    # default order: name asc, year asc, pieces asc, rating desc
    if order is None:
        order = "desc" if sort == "rating" else "asc"
    reverse = (order == "desc")

    enriched.sort(key=_sort_key(sort), reverse=reverse)

    # pagination
    total = len(enriched)
    start = (page - 1) * limit
    end = start + limit
    page_rows = enriched[start:end]

    # strip synthetic keys from response
    for r in page_rows:
        r["rating_avg"] = r.pop("_avg_rating", 0.0)
        r["rating_count"] = r.pop("_rating_count", 0)

    response.headers["X-Total-Count"] = str(total)
    return page_rows


@router.get("/{set_num}")
def get_set(set_num: str):
    """
    Return a single set by set number (accepts '10305' or '10305-1').
    Includes rating summary if reviews exist.
    """
    s = get_set_by_num(set_num)
    if not s:
        raise HTTPException(status_code=404, detail="Set not found")

    avg, count = _rating_stats_for_set(s.get("set_num") or "")
    out = dict(s)
    out["rating_avg"] = avg
    out["rating_count"] = count
    return out