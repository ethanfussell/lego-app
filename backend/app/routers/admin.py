# backend/app/routers/admin.py
from __future__ import annotations

from fastapi import APIRouter

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/sets/refresh")
def refresh_sets():
    """
    Trigger a cache refresh from Rebrickable + sync to DB.
    No auth for now — add admin auth later.
    """
    from scripts.refresh_sets import sync_cache_to_db

    stats = sync_cache_to_db(skip_fetch=False)
    return {"ok": True, **stats}


@router.post("/sets/sync")
def sync_sets():
    """
    Sync existing cache to DB without fetching from Rebrickable.
    Useful when cache is already up-to-date.
    """
    from scripts.refresh_sets import sync_cache_to_db

    stats = sync_cache_to_db(skip_fetch=True)
    return {"ok": True, **stats}
