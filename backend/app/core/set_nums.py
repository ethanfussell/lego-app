# backend/app/core/set_nums.py
from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models import Set as SetModel


def base_set_num(raw: str) -> str:
    return (raw or "").strip().split("-", 1)[0].strip()


def resolve_set_num(db: Session, raw: str) -> str:
    """
    Accepts base ("10305") or full ("10305-1") and returns canonical full set_num that exists in sets table.
    Prefers "<base>-1" when base is passed.
    """
    raw = (raw or "").strip()
    if not raw:
        raise HTTPException(status_code=422, detail="set_num_required")

    base = base_set_num(raw)
    if not base:
        raise HTTPException(status_code=422, detail="set_num_required")

    # 1) exact match first (case-insensitive)
    exact = db.execute(
        select(SetModel.set_num)
        .where(func.lower(SetModel.set_num) == raw.lower())
        .limit(1)
    ).scalar_one_or_none()
    if exact:
        return str(exact)

    # 2) base -> prefer base-1 if present
    prefer = f"{base}-1"
    preferred = db.execute(
        select(SetModel.set_num)
        .where(func.lower(SetModel.set_num) == prefer.lower())
        .limit(1)
    ).scalar_one_or_none()
    if preferred:
        return str(preferred)

    # 3) otherwise any variant for that base (deterministic)
    plain_expr = func.split_part(SetModel.set_num, "-", 1)
    any_variant = db.execute(
        select(SetModel.set_num)
        .where(func.lower(plain_expr) == base.lower())
        .order_by(func.lower(SetModel.set_num).asc())
        .limit(1)
    ).scalar_one_or_none()

    if not any_variant:
        raise HTTPException(status_code=404, detail="set_not_found")

    return str(any_variant)