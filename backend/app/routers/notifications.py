# backend/app/routers/notifications.py
"""Notification endpoints + helper to create notifications."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session

from app.core.auth import get_current_user
from app.db import get_db
from app.models import Notification, User

router = APIRouter(prefix="/notifications", tags=["notifications"])


# ---------------------------------------------------------------------------
# Helper: create a notification (called from other routers)
# ---------------------------------------------------------------------------

def create_notification(
    db: Session,
    *,
    user_id: int,
    type: str,
    actor_id: int | None = None,
    target_id: int | None = None,
) -> None:
    """Fire-and-forget notification creation. Skips if actor == user."""
    if actor_id and actor_id == user_id:
        return  # Don't notify yourself
    db.add(Notification(
        user_id=user_id,
        type=type,
        actor_id=actor_id,
        target_id=target_id,
    ))
    # Caller is responsible for commit


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("")
def list_notifications(
    limit: int = Query(30, ge=1, le=100),
    offset: int = Query(0, ge=0),
    unread_only: bool = Query(False),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    condition = Notification.user_id == user.id
    if unread_only:
        condition = condition & (Notification.read == False)  # noqa: E712

    total = db.execute(
        select(func.count()).select_from(Notification).where(condition)
    ).scalar() or 0

    rows = db.execute(
        select(Notification)
        .where(condition)
        .order_by(Notification.created_at.desc())
        .limit(limit)
        .offset(offset)
    ).scalars().all()

    return {
        "total": total,
        "notifications": [_notif_to_dict(n) for n in rows],
    }


@router.get("/unread-count")
def unread_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    count = db.execute(
        select(func.count())
        .select_from(Notification)
        .where(Notification.user_id == user.id, Notification.read == False)  # noqa: E712
    ).scalar() or 0
    return {"unread_count": count}


@router.post("/mark-read")
def mark_all_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(
        update(Notification)
        .where(Notification.user_id == user.id, Notification.read == False)  # noqa: E712
        .values(read=True)
    )
    db.commit()
    return {"status": "ok"}


@router.post("/{notification_id}/read")
def mark_one_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    notif = db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
    ).scalar_one_or_none()

    if not notif:
        return {"status": "not_found"}

    notif.read = True
    db.commit()
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Serialization
# ---------------------------------------------------------------------------

def _notif_to_dict(n: Notification) -> dict:
    actor = n.actor
    return {
        "id": n.id,
        "type": n.type,
        "target_id": n.target_id,
        "read": n.read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
        "actor": {
            "id": actor.id,
            "username": actor.username,
            "display_name": actor.display_name,
            "avatar_url": actor.avatar_url,
        } if actor else None,
    }
