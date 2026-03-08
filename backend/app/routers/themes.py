# backend/app/routers/themes.py
from __future__ import annotations

import unicodedata
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session

from app.data.sets import load_cached_sets
from app.data import offers as offers_data
from app.db import get_db
from app.models import AdminSetting

import json as _json

router = APIRouter(prefix="/themes", tags=["themes"])


def _load_theme_settings(db: Session):
    """Load themes_excluded (list) and themes_custom_images (dict) from admin_settings."""
    excluded: List[str] = []
    custom_images: Dict[str, str] = {}
    try:
        row = db.query(AdminSetting).filter_by(key="themes_excluded").first()
        if row and row.value:
            parsed = _json.loads(row.value)
            if isinstance(parsed, list):
                excluded = [str(t) for t in parsed]
    except Exception:
        pass
    try:
        row = db.query(AdminSetting).filter_by(key="themes_custom_images").first()
        if row and row.value:
            parsed = _json.loads(row.value)
            if isinstance(parsed, dict):
                custom_images = {str(k): str(v) for k, v in parsed.items()}
    except Exception:
        pass
    return excluded, custom_images

ALLOWED_SORTS = {"relevance", "year", "pieces", "name", "rating"}
ALLOWED_ORDERS = {"asc", "desc"}


def _strip_diacritics(s: str) -> str:
    """Remove diacritical marks: é → e, ü → u, etc."""
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )


def _norm(s: str) -> str:
    return (s or "").strip()


def _norm_lower(s: str) -> str:
    return _strip_diacritics(_norm(s)).lower()


def _theme_key(theme: str) -> str:
    # stable key for comparisons / grouping (accent-insensitive)
    return _norm_lower(theme)


def _set_count_by_theme(
    all_sets: List[Dict[str, Any]],
    q: str,
    min_year: Optional[int] = None,
) -> List[Tuple[str, int, Optional[str]]]:
    """Returns list of (display_theme, set_count, image_url)."""
    ql = _norm_lower(q)
    counts: Dict[str, int] = {}
    display: Dict[str, str] = {}
    # Track the best image per theme: pick the set with the most pieces
    best_image: Dict[str, Tuple[int, Optional[str]]] = {}  # key -> (pieces, url)

    for s in all_sets:
        theme = _norm(str(s.get("theme") or ""))
        if not theme:
            continue

        if min_year is not None:
            try:
                if int(s.get("year") or 0) < min_year:
                    continue
            except (ValueError, TypeError):
                continue

        k = _theme_key(theme)
        if ql and ql not in k:
            continue

        counts[k] = counts.get(k, 0) + 1
        display.setdefault(k, theme)

        img = s.get("image_url") or None
        if img:
            pieces = int(s.get("pieces") or 0)
            prev = best_image.get(k)
            if prev is None or pieces > prev[0]:
                best_image[k] = (pieces, img)

    rows = [
        (display[k], counts[k], (best_image.get(k) or (0, None))[1])
        for k in counts.keys()
    ]
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
    min_year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """
    Returns: [{"theme": "Castle", "set_count": 123}, ...]
    Header: X-Total-Count = total number of distinct themes matching filters
    Pass min_year to filter to themes with sets from that year onward.
    """
    all_sets = load_cached_sets()
    excluded, custom_images = _load_theme_settings(db)
    excluded_lower = {t.lower() for t in excluded}

    rows = _set_count_by_theme(all_sets, q or "", min_year=min_year)

    # Filter out excluded themes
    if excluded_lower:
        rows = [(t, c, i) for t, c, i in rows if t.lower() not in excluded_lower]

    total = len(rows)
    response.headers["X-Total-Count"] = str(total)

    offset = (page - 1) * limit
    page_rows = rows[offset : offset + limit]

    return [
        {
            "theme": theme,
            "set_count": int(cnt),
            "image_url": custom_images.get(theme, img),
        }
        for (theme, cnt, img) in page_rows
    ]


@router.get("/{theme}/sets")
def list_sets_for_theme(
    theme: str,
    response: Response,
    page: int = Query(1, ge=1),
    limit: int = Query(36, ge=1, le=200),
    sort: str = Query("relevance"),
    order: str = Query("desc"),
    q: Optional[str] = Query(None),
    db: Session = Depends(get_db),
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
    page_result = filtered[offset : offset + limit]
    offers_data.enrich_with_best_prices(db, page_result)
    return page_result