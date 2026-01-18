# backend/app/api/themes.py (only showing the sets endpoint with changes)

from fastapi import APIRouter, Depends, HTTPException, Response, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from ..db import get_db
from ..models import Set as SetModel

router = APIRouter(prefix="/themes", tags=["themes"])

@router.get("/{theme}/sets")
def list_sets_for_theme(
    theme: str,
    response: Response,
    db: Session = Depends(get_db),
    limit: int = 24,
    offset: int = 0,
    sort: str = Query("year"),            # NEW
    order: str = Query("desc"),           # NEW
):
    limit = min(max(int(limit), 1), 100)
    offset = max(int(offset), 0)

    allowed_sorts = {"name", "year", "pieces"}
    if sort not in allowed_sorts:
        raise HTTPException(status_code=400, detail=f"Invalid sort '{sort}'")

    if order not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail=f"Invalid order '{order}'")

    total = db.execute(
        select(func.count()).select_from(SetModel).where(SetModel.theme == theme)
    ).scalar_one()

    if int(total) == 0:
        raise HTTPException(status_code=404, detail="theme_not_found")

    response.headers["X-Total-Count"] = str(int(total))

    # Build order_by
    # Add stable tie-breakers so pagination is deterministic
    if sort == "name":
        primary = SetModel.name.asc()
        if order == "desc":
            primary = SetModel.name.desc()
        order_by = [primary, SetModel.set_num.asc()]

    elif sort == "pieces":
        primary = SetModel.pieces.asc().nullslast()
        if order == "desc":
            primary = SetModel.pieces.desc().nullslast()
        order_by = [primary, SetModel.name.asc(), SetModel.set_num.asc()]

    else:  # sort == "year"
        primary = SetModel.year.asc().nullslast()
        if order == "desc":
            primary = SetModel.year.desc().nullslast()
        order_by = [primary, SetModel.name.asc(), SetModel.set_num.asc()]

    rows = db.execute(
        select(
            SetModel.set_num,
            SetModel.name,
            SetModel.year,
            SetModel.theme,
            SetModel.pieces,
            SetModel.image_url,
        )
        .where(SetModel.theme == theme)
        .order_by(*order_by)
        .offset(offset)
        .limit(limit)
    ).all()

    return [
        {
            "set_num": set_num,
            "name": name,
            "year": year,
            "theme": theme_val,
            "pieces": pieces,
            "image_url": image_url,
        }
        for (set_num, name, year, theme_val, pieces, image_url) in rows
    ]