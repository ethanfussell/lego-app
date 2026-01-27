# backend/app/core/set_nums.py
from __future__ import annotations

from typing import Optional

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.data.sets import get_set_by_num
from app.models import Set as SetModel


def base_set_num(s: str) -> str:
    s = (s or "").strip()
    if not s:
        return ""
    return s.split("-", 1)[0].strip()


def resolve_set_num(db: Session, raw: str) -> str:
    """
    Canonicalize a user-provided set number using the cached set index
    (same behavior as /sets/{set_num}), and ensure a SetModel row exists
    so joins (collections, reviews) work in production.
    """
    raw = (raw or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="missing_set_num")

    s = get_set_by_num(raw)  # ✅ cache-based resolver
    if not s:
        raise HTTPException(status_code=404, detail="set_not_found")

    canonical = str(s.get("set_num") or "").strip()
    if not canonical:
        raise HTTPException(status_code=404, detail="set_not_found")

    # ✅ ensure DB row exists for joins
    existing = db.execute(
        select(SetModel).where(SetModel.set_num == canonical).limit(1)
    ).scalar_one_or_none()

    if not existing:
        row = SetModel(
            set_num=canonical,
            set_num_plain=str(s.get("set_num_plain") or base_set_num(canonical)),
            name=str(s.get("name") or ""),
            year=s.get("year"),
            pieces=s.get("pieces"),
            theme=str(s.get("theme") or ""),
            image_url=str(s.get("image_url") or ""),
        )
        db.add(row)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    else:
        # optional: lightly backfill if empty
        changed = False
        if not (existing.name or "").strip() and s.get("name"):
            existing.name = str(s.get("name") or "")
            changed = True
        if not (existing.image_url or "").strip() and s.get("image_url"):
            existing.image_url = str(s.get("image_url") or "")
            changed = True
        if changed:
            db.commit()

    return canonical