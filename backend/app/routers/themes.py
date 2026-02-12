# backend/app/routers/themes.py
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Set as SetModel

router = APIRouter(tags=["themes"])


@router.get("/themes")
def list_themes(
    q: str | None = None,
    page: int = 1,
    limit: int = 60,
    db: Session = Depends(get_db),
):
    page = max(1, int(page or 1))
    limit = min(200, max(1, int(limit or 60)))
    offset = (page - 1) * limit

    theme_col = func.nullif(func.trim(SetModel.theme), "")

    stmt = (
        select(
            theme_col.label("theme"),
            func.count(SetModel.set_num).label("sets_count"),
        )
        .where(theme_col.isnot(None))
        .group_by(theme_col)
        .order_by(func.count(SetModel.set_num).desc(), theme_col.asc())
        .offset(offset)
        .limit(limit)
    )

    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(SetModel.theme.ilike(like))

    rows = db.execute(stmt).all()
    return [{"theme": r.theme, "sets_count": int(r.sets_count)} for r in rows]