# backend/app/routers/themes.py
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Set as SetModel

# ✅ Keep the prefix here, and do NOT add another /themes prefix in main.py
router = APIRouter(prefix="/themes", tags=["themes"])


def _set_to_dict(s: SetModel) -> Dict[str, Any]:
    return {
        "set_num": getattr(s, "set_num", None),
        "name": getattr(s, "name", None),
        "year": getattr(s, "year", None),
        "theme": getattr(s, "theme", None),
        "pieces": getattr(s, "pieces", None),
        "image_url": getattr(s, "image_url", None),
        "price_from": getattr(s, "price_from", None),
        "average_rating": getattr(s, "average_rating", None),
        "rating_count": getattr(s, "rating_count", None),
    }


@router.get("")
def list_themes(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Returns: [{"theme": "Castle", "set_count": 123}, ...]
    """
    rows = db.execute(
        select(
            SetModel.theme.label("theme"),
            func.count(SetModel.set_num).label("set_count"),
        )
        .where(SetModel.theme.is_not(None))
        .where(func.length(func.trim(SetModel.theme)) > 0)
        .group_by(SetModel.theme)
        .order_by(SetModel.theme.asc())
    ).all()

    return [{"theme": theme, "set_count": int(set_count)} for (theme, set_count) in rows]


@router.get("/{theme}/sets")
def list_sets_for_theme(
    theme: str,
    response: Response,
    db: Session = Depends(get_db),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
) -> List[Dict[str, Any]]:
    """
    Returns a paginated list of sets for a theme.
    Sets header: X-Total-Count
    Must 404 if theme doesn't exist at all.
    """
    theme = (theme or "").strip()
    if not theme:
        raise HTTPException(status_code=404, detail="theme_not_found")

    total = db.execute(
        select(func.count(SetModel.set_num)).where(SetModel.theme == theme)
    ).scalar_one()
    total_int = int(total or 0)

    if total_int == 0:
        raise HTTPException(status_code=404, detail="theme_not_found")

    response.headers["X-Total-Count"] = str(total_int)

    offset = (page - 1) * limit
    rows = db.execute(
        select(SetModel)
        .where(SetModel.theme == theme)
        .order_by(
            SetModel.year.desc().nulls_last(),
            SetModel.set_num.asc(),
        )
        .offset(offset)
        .limit(limit)
    ).scalars().all()

    return [_set_to_dict(s) for s in rows]