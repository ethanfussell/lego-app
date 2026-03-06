# backend/app/routers/alerts.py
from __future__ import annotations

from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.core.limiter import limiter
from app.db import get_db
from app.models import DealAlert, User as UserModel

router = APIRouter(prefix="/alerts", tags=["alerts"])


# ---- Schemas ----

class AlertCreate(BaseModel):
    set_num: str
    alert_type: str = "price_drop"

    @field_validator("alert_type")
    @classmethod
    def validate_alert_type(cls, v: str) -> str:
        if v not in ("price_drop", "retiring"):
            raise ValueError("alert_type must be 'price_drop' or 'retiring'")
        return v


# ---- Endpoints ----

@router.post("", status_code=status.HTTP_201_CREATED)
@limiter.limit("30/minute")
def create_alert(
    request: Request,
    payload: AlertCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Create a deal alert for a set."""
    alert = DealAlert(
        user_id=current_user.id,
        set_num=payload.set_num.strip(),
        alert_type=payload.alert_type,
    )
    db.add(alert)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="alert_already_exists")

    db.refresh(alert)
    return {
        "id": alert.id,
        "set_num": alert.set_num,
        "alert_type": alert.alert_type,
        "active": alert.active,
        "created_at": alert.created_at,
    }


@router.get("/me")
def list_my_alerts(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """List all alerts for the current user."""
    rows = db.execute(
        select(DealAlert)
        .where(DealAlert.user_id == current_user.id, DealAlert.active.is_(True))
        .order_by(DealAlert.created_at.desc())
    ).scalars().all()

    return [
        {
            "id": a.id,
            "set_num": a.set_num,
            "alert_type": a.alert_type,
            "active": a.active,
            "created_at": a.created_at,
        }
        for a in rows
    ]


@router.get("/me/{set_num}")
def get_alert_for_set(
    set_num: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Check if the user has an alert for a specific set."""
    alert = db.execute(
        select(DealAlert).where(
            DealAlert.user_id == current_user.id,
            DealAlert.set_num == set_num.strip(),
            DealAlert.active.is_(True),
        )
    ).scalar_one_or_none()

    if alert is None:
        return {"has_alert": False, "set_num": set_num}

    return {
        "has_alert": True,
        "id": alert.id,
        "set_num": alert.set_num,
        "alert_type": alert.alert_type,
        "created_at": alert.created_at,
    }


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert(
    alert_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete (deactivate) an alert."""
    alert = db.execute(
        select(DealAlert).where(
            DealAlert.id == alert_id,
            DealAlert.user_id == current_user.id,
        )
    ).scalar_one_or_none()

    if alert is None:
        raise HTTPException(status_code=404, detail="alert_not_found")

    db.delete(alert)
    db.commit()
