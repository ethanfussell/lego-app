# backend/app/routers/follows.py
"""Follow/unfollow endpoints. One-way follow system (like Instagram)."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select, and_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.auth import get_current_user, get_current_user_optional
from app.core.limiter import limiter
from app.db import get_db
from app.models import Follower, User
from app.routers.notifications import create_notification

router = APIRouter(prefix="/users", tags=["follows"])


@router.post("/{username}/follow", status_code=201)
@limiter.limit("30/minute")
def follow_user(
    request: Request,
    username: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Follow a user by username."""
    target = db.execute(
        select(User).where(User.username == username).limit(1)
    ).scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="user_not_found")

    if target.id == user.id:
        raise HTTPException(status_code=400, detail="cannot_follow_self")

    existing = db.execute(
        select(Follower).where(
            and_(Follower.follower_id == user.id, Follower.following_id == target.id)
        )
    ).scalar_one_or_none()

    if existing:
        return {"status": "already_following"}

    db.add(Follower(follower_id=user.id, following_id=target.id))
    create_notification(db, user_id=target.id, type="new_follower", actor_id=user.id)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"status": "already_following"}

    return {"status": "following"}


@router.delete("/{username}/follow")
@limiter.limit("30/minute")
def unfollow_user(
    request: Request,
    username: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Unfollow a user by username."""
    target = db.execute(
        select(User).where(User.username == username).limit(1)
    ).scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="user_not_found")

    row = db.execute(
        select(Follower).where(
            and_(Follower.follower_id == user.id, Follower.following_id == target.id)
        )
    ).scalar_one_or_none()

    if not row:
        return {"status": "not_following"}

    db.delete(row)
    db.commit()
    return {"status": "unfollowed"}


@router.get("/{username}/followers")
def get_followers(username: str, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    """Get list of users who follow this user."""
    target = db.execute(
        select(User).where(User.username == username).limit(1)
    ).scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="user_not_found")

    total = db.execute(
        select(func.count()).select_from(Follower).where(Follower.following_id == target.id)
    ).scalar() or 0

    rows = db.execute(
        select(User)
        .join(Follower, Follower.follower_id == User.id)
        .where(Follower.following_id == target.id)
        .order_by(Follower.created_at.desc())
        .limit(min(limit, 100))
        .offset(offset)
    ).scalars().all()

    return {
        "total": total,
        "users": [
            {
                "id": int(u.id),
                "username": u.username,
                "display_name": u.display_name,
                "avatar_url": u.avatar_url,
            }
            for u in rows
        ],
    }


@router.get("/{username}/following")
def get_following(username: str, limit: int = 50, offset: int = 0, db: Session = Depends(get_db)):
    """Get list of users this user follows."""
    target = db.execute(
        select(User).where(User.username == username).limit(1)
    ).scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="user_not_found")

    total = db.execute(
        select(func.count()).select_from(Follower).where(Follower.follower_id == target.id)
    ).scalar() or 0

    rows = db.execute(
        select(User)
        .join(Follower, Follower.following_id == User.id)
        .where(Follower.follower_id == target.id)
        .order_by(Follower.created_at.desc())
        .limit(min(limit, 100))
        .offset(offset)
    ).scalars().all()

    return {
        "total": total,
        "users": [
            {
                "id": int(u.id),
                "username": u.username,
                "display_name": u.display_name,
                "avatar_url": u.avatar_url,
            }
            for u in rows
        ],
    }


@router.get("/{username}/follow-counts")
def get_follow_counts(username: str, db: Session = Depends(get_db)):
    """Get follower and following counts for a user."""
    target = db.execute(
        select(User).where(User.username == username).limit(1)
    ).scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="user_not_found")

    followers_count = db.execute(
        select(func.count()).select_from(Follower).where(Follower.following_id == target.id)
    ).scalar() or 0

    following_count = db.execute(
        select(func.count()).select_from(Follower).where(Follower.follower_id == target.id)
    ).scalar() or 0

    return {
        "followers_count": followers_count,
        "following_count": following_count,
    }


@router.get("/{username}/is-following")
def check_is_following(
    username: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Check if the current user follows a given user."""
    target = db.execute(
        select(User).where(User.username == username).limit(1)
    ).scalar_one_or_none()

    if not target:
        raise HTTPException(status_code=404, detail="user_not_found")

    exists = db.execute(
        select(Follower).where(
            and_(Follower.follower_id == user.id, Follower.following_id == target.id)
        )
    ).scalar_one_or_none()

    return {"is_following": exists is not None}


@router.get("/suggested")
def suggested_users(
    limit: int = 5,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Suggest users to follow — users the current user doesn't follow yet."""
    already_following = (
        select(Follower.following_id)
        .where(Follower.follower_id == user.id)
        .subquery()
    )

    rows = db.execute(
        select(User)
        .where(
            User.id != user.id,
            User.id.notin_(already_following),
        )
        .order_by(func.random())
        .limit(min(limit, 20))
    ).scalars().all()

    return {
        "users": [
            {
                "id": int(u.id),
                "username": u.username,
                "display_name": u.display_name,
                "avatar_url": u.avatar_url,
            }
            for u in rows
        ],
    }
