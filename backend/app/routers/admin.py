# backend/app/routers/admin.py
from __future__ import annotations

from fastapi import APIRouter, Depends, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import get_admin_user
from app.core.limiter import limiter
from app.db import get_db
from app.models import User as UserModel, Set as SetModel, EmailSignup

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/stats")
@limiter.limit("10/minute")
def admin_stats(
    request: Request,
    admin: UserModel = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Dashboard stats for admin UI."""
    set_count = db.execute(select(func.count()).select_from(SetModel)).scalar_one()
    user_count = db.execute(select(func.count()).select_from(UserModel)).scalar_one()
    signup_count = db.execute(select(func.count()).select_from(EmailSignup)).scalar_one()
    return {
        "set_count": set_count,
        "user_count": user_count,
        "email_signup_count": signup_count,
    }


@router.post("/sets/refresh")
@limiter.limit("10/minute")
def refresh_sets(request: Request, admin: UserModel = Depends(get_admin_user)):
    """Trigger a cache refresh from Rebrickable + sync to DB."""
    from scripts.refresh_sets import sync_cache_to_db

    stats = sync_cache_to_db(skip_fetch=False)
    return {"ok": True, **stats}


@router.post("/sets/sync")
@limiter.limit("10/minute")
def sync_sets(request: Request, admin: UserModel = Depends(get_admin_user)):
    """Sync existing cache to DB without fetching from Rebrickable."""
    from scripts.refresh_sets import sync_cache_to_db

    stats = sync_cache_to_db(skip_fetch=True)
    return {"ok": True, **stats}
