# backend/app/api/themes.py
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..data.sets import load_cached_sets
from ..db import get_db
from ..models import Review as ReviewModel

router = APIRouter(
    prefix="/themes",
    tags=["themes"],
)


def _sort_key(sort: str):
    if sort == "name":
        return lambda r: (r.get("name") or "").lower()
    if sort == "year":
        return lambda r: int(r.get("year") or 0)
    if sort == "pieces":
        return lambda r: int(r.get("pieces") or 0)
    if sort == "rating":
        # avg first, then count
        return lambda r: (r.get("_avg_rating") or 0.0, r.get("_rating_count") or 0)
    return lambda r: (r.get("name") or "").lower()


def _ratings_for_set_nums(db: Session, set_nums: List[str]) -> Dict[str, Tuple[Optional[float], int]]:
    if not set_nums:
        return {}

    rows = db.execute(
        select(
            ReviewModel.set_num,
            func.avg(ReviewModel.rating),
            func.count(ReviewModel.rating),
        )
        .where(
            ReviewModel.rating.is_not(None),
            ReviewModel.set_num.in_(set_nums),
        )
        .group_by(ReviewModel.set_num)
    ).all()

    out: Dict[str, Tuple[Optional[float], int]] = {}
    for set_num, avg, cnt in rows:
        cnt_i = int(cnt or 0)
        avg_f: Optional[float] = round(float(avg), 2) if (avg is not None and cnt_i > 0) else None
        out[str(set_num)] = (avg_f, cnt_i)
    return out


@router.get("/{theme}/sets")
def list_sets_for_theme(
    theme: str,
    response: Response,
    page: int = Query(1, ge=1),
    limit: int = Query(36, ge=1, le=100),
    sort: str = Query("relevance"),
    order: Optional[str] = Query(None),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Strict theme browsing:
    - Filters cached sets where set["theme"] equals {theme} (case-insensitive).
    - Supports sorting (name/year/pieces/rating/relevance) + pagination.
    - Returns same shape as /sets (adds average_rating/rating_avg/rating_count).
    - Sets X-Total-Count header.
    """
    theme_clean = (theme or "").strip()
    if not theme_clean:
        raise HTTPException(status_code=422, detail="theme_required")

    all_sets = load_cached_sets()
    want = theme_clean.lower()

    # STRICT: exact theme match (case-insensitive)
    filtered = [
        s for s in all_sets
        if str(s.get("theme") or "").strip().lower() == want
    ]

    # If you want *purely strict*, keep this as-is.
    # If you'd rather have a fallback (optional), tell me and I’ll add it.

    # ratings for these sets
    canonicals = [str(s.get("set_num") or "") for s in filtered if s.get("set_num")]
    ratings = _ratings_for_set_nums(db, canonicals)

    enriched: List[Dict[str, Any]] = []
    for s in filtered:
        canonical = str(s.get("set_num") or "")
        avg, cnt = ratings.get(canonical, (None, 0))
        s2 = dict(s)
        s2["_avg_rating"] = avg
        s2["_rating_count"] = cnt
        enriched.append(s2)

    allowed_sorts = {"relevance", "name", "year", "pieces", "rating"}
    if sort not in allowed_sorts:
        raise HTTPException(status_code=400, detail=f"Invalid sort '{sort}'")

    if order is None:
        order = "desc" if sort in {"relevance", "rating"} else "asc"
    reverse = (order.lower() == "desc")

    # "relevance" doesn't mean much for strict theme browse, so we make it "newest first"
    if sort == "relevance":
        enriched.sort(key=_sort_key("year"), reverse=True)
    else:
        enriched.sort(key=_sort_key(sort), reverse=reverse)

    total = len(enriched)
    start = (page - 1) * limit
    end = start + limit
    page_rows = enriched[start:end]

    for r in page_rows:
        avg = r.pop("_avg_rating", None)
        cnt = r.pop("_rating_count", 0)
        r["average_rating"] = avg
        r["rating_avg"] = avg
        r["rating_count"] = cnt

    response.headers["X-Total-Count"] = str(total)
    return page_rows