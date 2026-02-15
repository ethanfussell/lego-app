# backend/app/routers/themes.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Query, Response

from app.data.sets import load_cached_sets

router = APIRouter(prefix="/themes", tags=["themes"])

ALLOWED_SORTS = {"relevance", "year", "pieces", "name", "rating"}
ALLOWED_ORDERS = {"asc", "desc"}


def _norm(s: str) -> str:
    return (s or "").strip()


def _norm_lower(s: str) -> str:
    return _norm(s).lower()


def _theme_key(theme: str) -> str:
    # stable key for comparisons / grouping
    return _norm_lower(theme)


def _set_count_by_theme(all_sets: List[Dict[str, Any]], q: str) -> List[Tuple[str, int]]:
    ql = _norm_lower(q)
    counts: Dict[str, int] = {}
    display: Dict[str, str] = {}

    for s in all_sets:
        theme = _norm(str(s.get("theme") or ""))
        if not theme:
            continue

        k = _theme_key(theme)
        if ql and ql not in k:
            continue

        counts[k] = counts.get(k, 0) + 1
        # keep a nice display form (first seen)
        display.setdefault(k, theme)

    rows = [(display[k], counts[k]) for k in counts.keys()]
    rows.sort(key=lambda t: t[0].lower())
    return rows


def _sort_key(sort: str):
    if sort == "name":
        return lambda r: _norm_lower(str(r.get("name") or ""))
    if sort == "year":
        return lambda r: int(r.get("year") or 0)
    if sort == "pieces":
        return lambda r: int(r.get("pieces") or 0)
    if sort == "rating":
        # cached sets may not have rating fields; treat missing as 0
        return lambda r: (float(r.get("average_rating") or r.get("rating_avg") or 0.0), int(r.get("rating_count") or 0))
    # relevance default (we'll handle separately)
    return lambda r: _norm_lower(str(r.get("name") or ""))


def _relevance_score(s: Dict[str, Any], q: str) -> int:
    ql = _norm_lower(q)
    if not ql:
        return 0
    name = _norm_lower(str(s.get("name") or ""))
    theme = _norm_lower(str(s.get("theme") or ""))
    set_num = _norm_lower(str(s.get("set_num") or ""))

    score = 0
    if set_num == ql:
        score += 100
    if name.startswith(ql):
        score += 60
    if ql in name:
        score += 40
    if ql in theme:
        score += 20
    return score


@router.get("")
def list_themes(
    response: Response,
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(60, ge=1, le=200),
) -> List[Dict[str, Any]]:
    """
    Returns: [{"theme": "Castle", "set_count": 123}, ...]
    Header: X-Total-Count = total number of distinct themes matching filters
    """
    all_sets = load_cached_sets()

    rows = _set_count_by_theme(all_sets, q or "")
    total = len(rows)
    response.headers["X-Total-Count"] = str(total)

    offset = (page - 1) * limit
    page_rows = rows[offset : offset + limit]

    return [{"theme": theme, "set_count": int(cnt)} for (theme, cnt) in page_rows]


@router.get("/{theme}/sets")
def list_sets_for_theme(
    theme: str,
    response: Response,
    page: int = Query(1, ge=1),
    limit: int = Query(36, ge=1, le=200),
    sort: str = Query("relevance"),
    order: str = Query("desc"),
    q: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    """
    Returns a paginated list of cached sets for a theme.
    Header: X-Total-Count
    Must 404 if theme doesn't exist at all.
    """
    theme_raw = _norm(theme)
    if not theme_raw:
        raise HTTPException(status_code=404, detail="theme_not_found")

    sort = (sort or "relevance").strip()
    order = (order or "desc").strip().lower()

    if sort not in ALLOWED_SORTS:
        raise HTTPException(status_code=400, detail=f"invalid_sort:{sort}")
    if order not in ALLOWED_ORDERS:
        raise HTTPException(status_code=400, detail=f"invalid_order:{order}")

    all_sets = load_cached_sets()

    # determine whether theme exists at all (case-insensitive)
    target_key = _theme_key(theme_raw)
    theme_exists = any(_theme_key(str(s.get("theme") or "")) == target_key for s in all_sets)
    if not theme_exists:
        raise HTTPException(status_code=404, detail="theme_not_found")

    # filter to theme
    filtered = [
        s
        for s in all_sets
        if _theme_key(str(s.get("theme") or "")) == target_key
    ]

    # optional query within the theme page (search by name/set_num/theme)
    q_clean = _norm(q or "")
    if q_clean:
        ql = _norm_lower(q_clean)
        def matches(s: Dict[str, Any]) -> bool:
            return (
                ql in _norm_lower(str(s.get("name") or "")) or
                ql in _norm_lower(str(s.get("theme") or "")) or
                ql in _norm_lower(str(s.get("set_num") or "")) or
                ql == _norm_lower(str(s.get("set_num_plain") or ""))
            )
        filtered = [s for s in filtered if matches(s)]

    total = len(filtered)
    response.headers["X-Total-Count"] = str(total)

    reverse = (order == "desc")

    if sort == "relevance":
        if q_clean:
            filtered.sort(
                key=lambda s: (
                    _relevance_score(s, q_clean),
                    int(s.get("rating_count") or 0),
                    float(s.get("average_rating") or s.get("rating_avg") or 0.0),
                ),
                reverse=True,
            )
        else:
            filtered.sort(key=_sort_key("name"), reverse=False)
    else:
        filtered.sort(key=_sort_key(sort), reverse=reverse)

    offset = (page - 1) * limit
    return filtered[offset : offset + limit]