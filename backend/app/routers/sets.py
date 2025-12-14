# backend/app/routers/sets.py
from __future__ import annotations

from difflib import SequenceMatcher
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..data.sets import load_cached_sets, get_set_by_num
from ..data.offers import get_offers_for_set
from ..db import get_db
from ..models import Review as ReviewModel
from ..schemas.pricing import StoreOffer

router = APIRouter()

# ---------------- helpers ----------------

def _fuzzy_score_for_set(s: Dict[str, Any], q: str) -> float:
    q = (q or "").strip().lower()
    if not q:
        return 0.0

    candidates = [
        (s.get("name") or "").lower(),
        (s.get("ip") or "").lower(),
        (s.get("theme") or "").lower(),
    ]

    best = 0.0
    for text in candidates:
        if not text:
            continue
        best = max(best, SequenceMatcher(None, q, text).ratio())
    return best


def _matches_query(s: Dict[str, Any], q: str) -> bool:
    q = (q or "").strip().lower()
    if not q:
        return True

    name = (s.get("name") or "").lower()
    theme = (s.get("theme") or "").lower()
    set_num = (s.get("set_num") or "").lower()
    plain = (s.get("set_num_plain") or "").lower()

    return (q in name) or (q in theme) or (q in set_num) or (q == plain)


def _relevance_score(s: Dict[str, Any], q: str) -> int:
    q = (q or "").strip().lower()
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
    if sort == "name":
        return lambda r: (r.get("name") or "").lower()
    if sort == "year":
        return lambda r: (r.get("year") or 0)
    if sort == "pieces":
        return lambda r: (r.get("pieces") or 0)
    if sort == "rating":
        # (avg, count) so avg is primary, count is tie-breaker
        return lambda r: (r.get("_avg_rating") or 0.0, r.get("_rating_count") or 0)
    return lambda r: (r.get("name") or "").lower()


def _rating_stats_for_set(db: Session, set_num: str) -> Tuple[float, int]:
    """
    Returns (avg_rating, count_ratings) for ONE set_num from Postgres.
    Count includes only non-null ratings.
    """
    row = db.execute(
        select(
            func.avg(ReviewModel.rating),
            func.count(ReviewModel.rating),
        )
        .where(
            ReviewModel.set_num == set_num,
            ReviewModel.rating.is_not(None),
        )
    ).one()

    avg, cnt = row
    cnt_i = int(cnt or 0)
    avg_f = float(avg) if avg is not None else 0.0
    return (round(avg_f, 2), cnt_i)


def _ratings_map(db: Session) -> Dict[str, Tuple[float, int]]:
    """
    Returns { set_num: (avg_rating, count_ratings) } from Postgres.
    count_ratings counts only non-null ratings.
    """
    rows = db.execute(
        select(
            ReviewModel.set_num,
            func.avg(ReviewModel.rating),
            func.count(ReviewModel.rating),
        )
        .where(ReviewModel.rating.is_not(None))
        .group_by(ReviewModel.set_num)
    ).all()

    out: Dict[str, Tuple[float, int]] = {}
    for set_num, avg, cnt in rows:
        cnt_i = int(cnt or 0)
        avg_f = float(avg) if avg is not None else 0.0
        out[str(set_num)] = (round(avg_f, 2), cnt_i)
    return out

# ---------------- endpoints ----------------

@router.get("")
def list_sets(
    response: Response,
    q: Optional[str] = Query(None, description="Search across name, theme, set number"),
    page: int = Query(1, ge=1, description="Page number (1-based)"),
    limit: int = Query(20, ge=1, le=100, description="Page size"),
    sort: str = Query("relevance", description="Sort by: relevance | name | year | pieces | rating"),
    order: Optional[str] = Query(None, description="asc | desc (optional; defaults chosen per sort)"),
    db: Session = Depends(get_db),
):
    all_sets = load_cached_sets()
    sets = all_sets

    # 1) normal filter
    if q:
        sets = [s for s in sets if _matches_query(s, q)]

        # 2) fuzzy fallback if no matches
        if not sets:
            scored: List[Tuple[float, Dict[str, Any]]] = []
            for s in all_sets:
                score = _fuzzy_score_for_set(s, q)
                if score >= 0.55:
                    scored.append((score, s))
            scored.sort(key=lambda t: t[0], reverse=True)
            sets = [s for _, s in scored[:100]]

    # One DB query for all ratings (fast enough for MVP; optimize later if needed)
    ratings = _ratings_map(db)

    enriched: List[Dict[str, Any]] = []
    for s in sets:
        canonical = s.get("set_num") or ""
        avg, cnt = ratings.get(canonical, (0.0, 0))
        s2 = dict(s)
        s2["_avg_rating"] = avg
        s2["_rating_count"] = cnt
        enriched.append(s2)

    allowed_sorts = {"relevance", "name", "year", "pieces", "rating"}
    if sort not in allowed_sorts:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort '{sort}'. Allowed: {', '.join(sorted(allowed_sorts))}",
        )

    if order is None:
        order = "desc" if sort in {"relevance", "rating"} else "asc"
    reverse = (order == "desc")

    if sort == "relevance":
        if q:
            for r in enriched:
                r["_relevance"] = _relevance_score(r, q)
            enriched.sort(
                key=lambda r: (
                    r.get("_relevance") or 0,
                    r.get("_rating_count") or 0,
                    r.get("_avg_rating") or 0.0,
                ),
                reverse=True,
            )
        else:
            enriched.sort(key=_sort_key("name"), reverse=False)
    else:
        enriched.sort(key=_sort_key(sort), reverse=reverse)

    total = len(enriched)
    start = (page - 1) * limit
    end = start + limit
    page_rows = enriched[start:end]

    for r in page_rows:
        r["rating_avg"] = r.pop("_avg_rating", 0.0)
        r["rating_count"] = r.pop("_rating_count", 0)
        r.pop("_relevance", None)

    response.headers["X-Total-Count"] = str(total)
    return page_rows


@router.get("/suggest")
def suggest_sets(
    q: str = Query(..., min_length=1, description="User's partial or fuzzy query"),
    limit: int = Query(6, ge=1, le=20, description="Max suggestions to return"),
    db: Session = Depends(get_db),
):
    q_clean = (q or "").strip().lower()
    if not q_clean:
        return []

    all_sets = load_cached_sets()
    ratings = _ratings_map(db)

    # (total_score, rating_count, year, set_dict)
    candidates: List[Tuple[float, int, int, Dict[str, Any]]] = []

    for s in all_sets:
        name = (s.get("name") or "").lower()
        theme = (s.get("theme") or "").lower()
        set_num = (s.get("set_num") or "").lower()
        plain = (s.get("set_num_plain") or "").lower()

        base_score = 0.0
        direct = False

        if plain and plain == q_clean:
            base_score += 120
            direct = True
        if set_num and set_num == q_clean:
            base_score += 110
            direct = True
        if name.startswith(q_clean):
            base_score += 80
            direct = True
        if q_clean in name:
            base_score += 60
            direct = True
        if q_clean in theme:
            base_score += 30
            direct = True

        if not direct:
            fuzzy = _fuzzy_score_for_set(s, q_clean)
            if fuzzy < 0.5:
                continue
            base_score += fuzzy * 50.0

        canonical = s.get("set_num") or ""
        avg, cnt = ratings.get(canonical, (0.0, 0))
        pop_score = min(cnt, 50)

        total_score = base_score + pop_score
        year = int(s.get("year") or 0)
        candidates.append((total_score, int(cnt), year, s))

    candidates.sort(key=lambda t: (t[0], t[1], t[2]), reverse=True)
    top = [s for _, _, _, s in candidates[:limit]]

    return [
        {
            "set_num": s.get("set_num"),
            "name": s.get("name"),
            "ip": s.get("ip") or s.get("theme"),
            "year": s.get("year"),
        }
        for s in top
    ]


@router.get("/{set_num}/rating")
def get_set_rating_summary(
    set_num: str,
    db: Session = Depends(get_db),
):
    s = get_set_by_num(set_num)
    if not s:
        raise HTTPException(status_code=404, detail="Set not found")

    canonical = s.get("set_num") or set_num
    avg, cnt = _rating_stats_for_set(db, canonical)

    return {
        "set_num": canonical,
        "average": (avg if cnt > 0 else None),
        "count": cnt,
    }


@router.get("/{set_num}")
def get_set(set_num: str, db: Session = Depends(get_db)):
    s = get_set_by_num(set_num)
    if not s:
        raise HTTPException(status_code=404, detail="Set not found")

    canonical = s.get("set_num") or ""
    avg, cnt = _rating_stats_for_set(db, canonical)

    out = dict(s)
    out["rating_avg"] = avg
    out["rating_count"] = cnt
    return out


@router.get("/{set_num}/offers", response_model=List[StoreOffer])
def get_set_offers(set_num: str):
    s = get_set_by_num(set_num)
    if not s:
        raise HTTPException(status_code=404, detail="Set not found")

    plain = (s.get("set_num_plain") or "").strip() or s.get("set_num") or ""
    plain = plain.split("-")[0]
    return get_offers_for_set(plain)