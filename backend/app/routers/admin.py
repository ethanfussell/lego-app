# backend/app/routers/admin.py

import importlib
import threading
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from pydantic import BaseModel, field_validator
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.auth import get_admin_user
from app.core.limiter import limiter
from app.core.sanitize import sanitize_oneline
from app.db import get_db
from app.models import (
    User as UserModel,
    Set as SetModel,
    Offer as OfferModel,
    EmailSignup,
    Review as ReviewModel,
    AffiliateClick,
    AdminSetting,
    get_locked_fields,
    add_locked_fields,
    remove_locked_fields,
)

router = APIRouter(prefix="/admin", tags=["admin"])


# ---------------------------------------------------------------------------
# Pydantic schemas for admin set editing
# ---------------------------------------------------------------------------

class AdminSetUpdate(BaseModel):
    """Fields an admin can override. Only provided fields are updated."""
    image_url: Optional[str] = None
    launch_date: Optional[str] = None
    name: Optional[str] = None
    retail_price: Optional[float] = None
    theme: Optional[str] = None
    set_tag: Optional[str] = None

    @field_validator("name", "theme", "set_tag", mode="before")
    @classmethod
    def sanitize_text_fields(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        return sanitize_oneline(v) or None


class AdminSetUnlock(BaseModel):
    """Request body for unlocking specific fields."""
    fields: List[str]


class AdminSettingUpdate(BaseModel):
    """Request body for updating a setting."""
    value: Optional[str] = None


ADMIN_EDITABLE_FIELDS = {"image_url", "launch_date", "name", "retail_price", "theme", "set_tag"}
ALLOWED_SETTINGS = {
    "spotlight_set_num",
    "featured_themes",
    "retiring_hidden_sets",
    "retiring_excluded_themes",
    "discover_hidden_sections",
    "discover_section_config",
    "themes_excluded",
    "themes_custom_images",
    "quick_explore_cards",
}


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
    review_count = db.execute(select(func.count()).select_from(ReviewModel)).scalar_one()
    affiliate_click_count = db.execute(select(func.count()).select_from(AffiliateClick)).scalar_one()
    return {
        "set_count": set_count,
        "user_count": user_count,
        "email_signup_count": signup_count,
        "review_count": review_count,
        "affiliate_click_count": affiliate_click_count,
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


# ---------------------------
# Data pipeline management
# ---------------------------

_PIPELINES = {
    "rebrickable_sync": "app.pipelines.rebrickable_sync.run_rebrickable_sync",
    "retirement_scrape": "app.pipelines.retirement_scraper.run_retirement_scrape",
    "price_scrape": "app.pipelines.price_scraper.run_price_scrape",
    "msrp_seed": "app.pipelines.msrp_seed.run_msrp_seed",
    "brickset_sync": "app.pipelines.brickset_sync.run_brickset_sync",
    "coming_soon_scrape": "app.pipelines.coming_soon_scraper.run_coming_soon_scrape",
    "bricklink_prices": "app.pipelines.bricklink_prices.run_bricklink_prices",
    "retailer_scrape": "app.pipelines.retailer_scraper.run_retailer_scrape",
}


@router.post("/pipelines/{pipeline_name}/run")
@limiter.limit("5/minute")
def trigger_pipeline(
    pipeline_name: str,
    request: Request,
    admin: UserModel = Depends(get_admin_user),
):
    """Manually trigger a data pipeline."""
    if pipeline_name not in _PIPELINES:
        raise HTTPException(status_code=404, detail="unknown_pipeline")

    module_path, func_name = _PIPELINES[pipeline_name].rsplit(".", 1)
    mod = importlib.import_module(module_path)
    fn = getattr(mod, func_name)

    # Long-running pipelines (like bricklink_prices) run in background
    _LONG_RUNNING = {"bricklink_prices", "retailer_scrape"}
    if pipeline_name in _LONG_RUNNING:
        threading.Thread(target=fn, daemon=True).start()
        return {"ok": True, "pipeline": pipeline_name, "status": "started_in_background"}

    result = fn()
    return {"ok": True, "pipeline": pipeline_name, "result": result}


@router.get("/pipelines/status")
def pipeline_status(
    admin: UserModel = Depends(get_admin_user),
):
    """Show scheduler job status."""
    from app.core.scheduler import scheduler

    jobs = []
    for job in scheduler.get_jobs():
        jobs.append({
            "id": job.id,
            "next_run": job.next_run_time.isoformat() if job.next_run_time else None,
        })
    return {"running": scheduler.running, "jobs": jobs}


# ===================================================================
# Admin Set Editor
# ===================================================================

@router.get("/sets/{set_num}")
@limiter.limit("30/minute")
def admin_get_set(
    set_num: str,
    request: Request,
    admin: UserModel = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Return full set data including locked fields for the admin editor."""
    row = db.execute(
        select(SetModel).where(SetModel.set_num == set_num)
    ).scalar_one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="set_not_found")

    locked = get_locked_fields(row)

    return {
        "set_num": row.set_num,
        "name": row.name,
        "year": row.year,
        "theme": row.theme,
        "pieces": row.pieces,
        "image_url": row.image_url,
        "ip": row.ip,
        "retail_price": row.retail_price,
        "retail_currency": row.retail_currency,
        "launch_date": row.launch_date,
        "exit_date": row.exit_date,
        "retirement_status": row.retirement_status,
        "retirement_date": row.retirement_date,
        "description": row.description,
        "subtheme": row.subtheme,
        "set_tag": row.set_tag,
        "locked_fields": locked,
    }


@router.patch("/sets/{set_num}")
@limiter.limit("30/minute")
def admin_update_set(
    set_num: str,
    request: Request,
    payload: AdminSetUpdate = Body(...),
    admin: UserModel = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Update set fields and lock them so syncs won't overwrite."""
    row = db.execute(
        select(SetModel).where(SetModel.set_num == set_num)
    ).scalar_one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="set_not_found")

    # Only update fields that were actually provided in the request
    update_data = payload.model_dump(exclude_unset=True)
    changed_fields: list[str] = []

    for field_name, new_value in update_data.items():
        if field_name not in ADMIN_EDITABLE_FIELDS:
            continue
        if getattr(row, field_name) != new_value:
            setattr(row, field_name, new_value)
            changed_fields.append(field_name)

    if changed_fields:
        add_locked_fields(row, changed_fields)

    db.commit()
    db.refresh(row)

    return {
        "ok": True,
        "set_num": row.set_num,
        "updated_fields": changed_fields,
        "locked_fields": get_locked_fields(row),
    }


@router.delete("/sets/{set_num}/overrides")
@limiter.limit("30/minute")
def admin_unlock_fields(
    set_num: str,
    request: Request,
    payload: AdminSetUnlock = Body(...),
    admin: UserModel = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Unlock specific fields so the next sync will update them normally."""
    row = db.execute(
        select(SetModel).where(SetModel.set_num == set_num)
    ).scalar_one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="set_not_found")

    remove_locked_fields(row, payload.fields)
    db.commit()

    return {
        "ok": True,
        "set_num": row.set_num,
        "locked_fields": get_locked_fields(row),
    }


@router.post("/sets/{set_num}/reset")
@limiter.limit("10/minute")
def admin_reset_set(
    set_num: str,
    request: Request,
    admin: UserModel = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Reset all admin overrides and restore fields from the upstream API data."""
    from app.data.sets import get_set_by_num

    row = db.execute(
        select(SetModel).where(SetModel.set_num == set_num)
    ).scalar_one_or_none()

    if not row:
        raise HTTPException(status_code=404, detail="set_not_found")

    # Clear all locked fields
    row.admin_locked_fields = None

    # Clear custom set_tag (not in upstream data)
    row.set_tag = None

    # Restore editable fields from the upstream cached data
    upstream = get_set_by_num(set_num)
    restored_fields: list[str] = []

    if upstream:
        field_map = {
            "name": "name",
            "theme": "theme",
            "image_url": "image_url",
            "retail_price": "retail_price",
        }
        for db_field, api_field in field_map.items():
            api_val = upstream.get(api_field)
            if api_val is not None and getattr(row, db_field) != api_val:
                setattr(row, db_field, api_val)
                restored_fields.append(db_field)

    db.commit()
    db.refresh(row)

    return {
        "ok": True,
        "set_num": row.set_num,
        "restored_fields": restored_fields,
        "locked_fields": get_locked_fields(row),
    }


# ===================================================================
# Admin Settings (spotlight, featured themes, etc.)
# ===================================================================

@router.get("/settings")
@limiter.limit("30/minute")
def admin_list_settings(
    request: Request,
    admin: UserModel = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Return all admin settings."""
    rows = db.execute(select(AdminSetting)).scalars().all()
    return {
        row.key: {
            "value": row.value,
            "updated_at": row.updated_at.isoformat() if row.updated_at else None,
            "updated_by": row.updated_by,
        }
        for row in rows
    }


@router.put("/settings/{key}")
@limiter.limit("30/minute")
def admin_update_setting(
    key: str,
    request: Request,
    payload: AdminSettingUpdate = Body(...),
    admin: UserModel = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Upsert an admin setting."""
    if key not in ALLOWED_SETTINGS:
        raise HTTPException(status_code=400, detail="invalid_setting_key")

    row = db.execute(
        select(AdminSetting).where(AdminSetting.key == key)
    ).scalar_one_or_none()

    if row:
        row.value = payload.value
        row.updated_by = admin.username
    else:
        row = AdminSetting(key=key, value=payload.value, updated_by=admin.username)
        db.add(row)

    db.commit()
    return {"ok": True, "key": key, "value": payload.value}


# ===================================================================
# Admin ASIN Management (Amazon affiliate links)
# ===================================================================

class AdminAsinUpdate(BaseModel):
    """Request body for adding/updating an Amazon ASIN for a set."""
    asin: str

    @field_validator("asin", mode="before")
    @classmethod
    def validate_asin(cls, v: str) -> str:
        v = (v or "").strip().upper()
        if not v or len(v) != 10:
            raise ValueError("ASIN must be exactly 10 characters")
        return v


@router.put("/sets/{set_num}/asin")
@limiter.limit("30/minute")
def admin_set_asin(
    set_num: str,
    request: Request,
    payload: AdminAsinUpdate = Body(...),
    admin: UserModel = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Manually add or update an Amazon ASIN for a set, creating a direct product affiliate link."""
    import os
    from urllib.parse import quote
    from datetime import datetime, timezone

    plain = set_num.split("-")[0]
    amazon_tag = os.getenv("AMAZON_AFFILIATE_TAG", "bricktrack-20")
    direct_url = f"https://www.amazon.com/dp/{quote(payload.asin)}?tag={quote(amazon_tag)}"
    now = datetime.now(timezone.utc)

    existing = db.execute(
        select(OfferModel).where(
            OfferModel.set_num == plain,
            OfferModel.store == "Amazon",
        )
    ).scalar_one_or_none()

    if existing:
        existing.asin = payload.asin
        existing.url = direct_url
        existing.last_checked = now
        action = "updated"
    else:
        db.add(OfferModel(
            set_num=plain,
            store="Amazon",
            price=None,
            currency="USD",
            url=direct_url,
            in_stock=None,
            asin=payload.asin,
            last_checked=now,
        ))
        action = "created"

    db.commit()
    return {"ok": True, "set_num": plain, "asin": payload.asin, "url": direct_url, "action": action}


@router.delete("/sets/{set_num}/asin")
@limiter.limit("30/minute")
def admin_delete_asin(
    set_num: str,
    request: Request,
    admin: UserModel = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Remove an Amazon ASIN/offer for a set."""
    plain = set_num.split("-")[0]

    existing = db.execute(
        select(OfferModel).where(
            OfferModel.set_num == plain,
            OfferModel.store == "Amazon",
        )
    ).scalar_one_or_none()

    if not existing:
        raise HTTPException(status_code=404, detail="no_amazon_offer")

    db.delete(existing)
    db.commit()
    return {"ok": True, "set_num": plain, "action": "deleted"}


@router.post("/offers/cleanup")
@limiter.limit("5/minute")
def admin_cleanup_search_offers(
    request: Request,
    admin: UserModel = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    """Remove old search-only retailer offers (no price AND no ASIN).

    These were auto-generated as search URLs but we now only show
    retailers when we have a direct product link (ASIN) or actual price.
    """
    from sqlalchemy import and_

    # Delete Amazon offers with no ASIN and no price
    amazon_deleted = db.execute(
        OfferModel.__table__.delete().where(
            and_(
                OfferModel.store == "Amazon",
                OfferModel.asin.is_(None),
                OfferModel.price.is_(None),
            )
        )
    ).rowcount

    # Delete Target/Walmart offers with no price (we don't track these anymore)
    other_deleted = db.execute(
        OfferModel.__table__.delete().where(
            and_(
                OfferModel.store.in_(["Target", "Walmart"]),
                OfferModel.price.is_(None),
            )
        )
    ).rowcount

    db.commit()
    return {
        "ok": True,
        "amazon_search_offers_removed": amazon_deleted,
        "target_walmart_search_offers_removed": other_deleted,
    }
