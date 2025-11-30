# app/routers/sets.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple
from fastapi import APIRouter, HTTPException, Query, Response
from difflib import SequenceMatcher

from app.data.sets import load_cached_sets, get_set_by_num

router = APIRouter()

# --------- helpers ---------
def _rating_stats_for_set(set_num: str) -> Tuple[float, int]:
    """
    Compute (avg_rating, count) for a set by set_num from the in-memory REVIEWS list,
    if available. Returns (0.0, 0) if no reviews or if the reviews store isn’t present.
    """
    try:
        from app.data.reviews import REVIEWS  # type: ignore
    except Exception:
        return (0.0, 0)

    rows = [r for r in REVIEWS if (r.get("set_num") or "").lower() == set_num.lower()]
    if not rows:
        return (0.0, 0)

    ratings = [
        r.get("rating")
        for r in rows
        if isinstance(r.get("rating"), (int, float))
    ]
    if not ratings:
        return (0.0, 0)

    avg = sum(ratings) / len(ratings)
    return (round(avg, 2), len(ratings))

def _similarity(a: str, b: str) -> float:
    """Return similarity between two strings (0.0–1.0)."""
    return SequenceMatcher(None, a, b).ratio()

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

def _fuzzy_score_for_set(s: Dict[str, Any], q: str) -> float:
    """
    Return a similarity score (0.0–1.0) between the query and
    a set's name / theme / ip using difflib.SequenceMatcher.
    Higher = more similar.
    """
    q = (q or "").strip().lower()
    if not q:
        return 0.0

    candidates = [
        (s.get("name") or "").lower(),
        (s.get("theme") or "").lower(),
        (s.get("ip") or "").lower(),
    ]

    best = 0.0
    for text in candidates:
        if not text:
            continue
        ratio = SequenceMatcher(None, q, text).ratio()
        if ratio > best:
            best = ratio
    return best

    # things we want to match against
    candidates = [
        (s.get("name") or "").lower(),
        (s.get("ip") or "").lower(),
        (s.get("theme") or "").lower(),
    ]

    best = 0.0
    for text in candidates:
        if not text:
            continue
        ratio = difflib.SequenceMatcher(None, q, text).ratio()
        if ratio > best:
            best = ratio
    return best

def _relevance_score(s: Dict[str, Any], q: str) -> int:
    """
    Simple relevance score:
    - exact plain set number match
    - exact full set_num match
    - name startswith query
    - name contains query
    - theme contains query
    """
    q = q.strip().lower()
    if not q:
        return 0

    name = (s.get("name") or "").lower()
    theme = (s.get("theme") or "").lower()
    set_num = (s.get("set_num") or "").lower()
    plain = (s.get("set_num_plain") or "").lower()

    score = 0
    if plain and plain == q:
        score += 100
    if set_num and set_num == q:
        score += 90
    if name.startswith(q):
        score += 60
    if q in name:
        score += 40
    if q in theme:
        score += 20

    return score


def _sort_key(sort: str):
    """Return a key function for sorting. 'relevance' is handled separately."""
    if sort == "name":
        return lambda r: (r.get("name") or "").lower()
    if sort == "year":
        return lambda r: (r.get("year") or 0)
    if sort == "pieces":
        return lambda r: (r.get("pieces") or 0)
    if sort == "rating":
        return lambda r: (r.get("_avg_rating") or 0.0, r.get("_rating_count") or 0)
    return lambda r: (r.get("name") or "").lower()


# --------- main list endpoint: GET /sets ---------
@router.get("")
def list_sets(
    response: Response,
    q: Optional[str] = Query(None, description="Search across name, theme, set number"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
    sort: str = Query(
        "relevance",
        description="Sort by: relevance | name | year | pieces | rating",
    ),
    order: Optional[str] = Query(
        None, description="asc | desc (optional; defaults chosen per sort)"
    ),
):
    """
    List sets from the local cache with search, sorting, pagination,
    and rating summary (avg, count) if reviews exist.

    Now with typo-friendly fallback:
    - First try normal substring search (_matches_query)
    - If that finds 0 results and q is provided, use _fuzzy_score_for_set
      to return the closest matches instead.
    """
    all_sets = load_cached_sets()
    sets = all_sets

    # ---------- 1) NORMAL FILTER ----------
    if q:
        sets = [s for s in sets if _matches_query(s, q)]

        # ---------- 2) FUZZY FALLBACK IF NO MATCHES ----------
        if not sets:
            scored: List[Tuple[float, Dict[str, Any]]] = []

            for s in all_sets:
                score = _fuzzy_score_for_set(s, q)
                # tweak threshold as needed
                if score >= 0.55:
                    scored.append((score, s))

            # sort best matches first
            scored.sort(key=lambda t: t[0], reverse=True)

            # e.g. keep top 100 fuzzy matches
            sets = [s for score, s in scored[:100]]

    # enrich with rating stats
    enriched: List[Dict[str, Any]] = []
    for s in sets:
        avg, count = _rating_stats_for_set(s.get("set_num") or "")
        s2 = dict(s)
        s2["_avg_rating"] = avg
        s2["_rating_count"] = count
        enriched.append(s2)

    # validate sort
    allowed_sorts = {"relevance", "name", "year", "pieces", "rating"}
    if sort not in allowed_sorts:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort '{sort}'. Allowed: {', '.join(sorted(allowed_sorts))}",
        )

    # default order:
    # - relevance: desc
    # - rating:   desc
    # - others:   asc
    if order is None:
        if sort in {"relevance", "rating"}:
            order = "desc"
        else:
            order = "asc"
    reverse = (order == "desc")

    # sorting
    if sort == "relevance":
        if q:
            for r in enriched:
                r["_relevance"] = _relevance_score(r, q)
            enriched.sort(
                key=lambda r: (
                    r.get("_relevance") or 0,
                    r.get("_avg_rating") or 0.0,
                    r.get("_rating_count") or 0,
                ),
                reverse=True,
            )
        else:
            enriched.sort(key=_sort_key("name"), reverse=False)
    else:
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
        r.pop("_relevance", None)

    response.headers["X-Total-Count"] = str(total)
    return page_rows


# --------- autocomplete endpoint: GET /sets/suggest ---------
@router.get("/suggest")
def suggest_sets(
    q: str = Query(..., min_length=1, description="User's partial or fuzzy query"),
    limit: int = Query(6, ge=1, le=20, description="Max suggestions to return"),
):
    """
    Return fuzzy suggestions for misspelled / partial queries.
    Used by autocomplete and the 'Did you mean...' UI.
    """
    q = q.strip()
    if not q:
        return []

    sets = load_cached_sets()

    scored: List[Tuple[float, Dict[str, Any]]] = []

    for s in sets:
        name = (s.get("name") or "").lower()

        # If the query is literally inside the name, treat it as a strong match.
        if q.lower() in name:
            score = 1.0
        else:
            score = _fuzzy_score_for_set(s, q)

        # Only keep reasonably close matches
        if score >= 0.45:
            scored.append((score, s))

    # sort best matches first
    scored.sort(key=lambda t: t[0], reverse=True)

    top = [s for score, s in scored[:limit]]

    # Return a lightweight object (this is what your frontend expects)
    return [
        {
            "set_num": s.get("set_num"),
            "name": s.get("name"),
            "ip": s.get("ip") or s.get("theme"),
            "year": s.get("year"),
        }
        for s in top
    ]

# --------- single set endpoint: GET /sets/{set_num} ---------
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