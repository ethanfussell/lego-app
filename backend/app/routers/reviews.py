# backend/app/routers/reviews.py
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.auth import get_current_user
from ..core.set_nums import base_set_num
from ..data.sets import get_set_by_num
from ..db import get_db
from ..models import Review as ReviewModel
from ..models import Set as SetModel
from ..models import User as UserModel
from ..schemas.review import Review, ReviewCreate, MyReviewItem

# NOTE: this router is mounted with prefix="/sets" in main.py
router = APIRouter(tags=["reviews"])


# ---------------- helpers ----------------

def _review_to_dict(r: ReviewModel, username: str, image_url: Optional[str]) -> Dict[str, Any]:
    return {
        "id": int(r.id),
        "set_num": r.set_num,
        "user": username,
        "rating": float(r.rating) if r.rating is not None else None,
        "text": r.text,
        "image_url": image_url,
        "created_at": r.created_at,
        "updated_at": getattr(r, "updated_at", None),
        "likes_count": 0,
        "liked_by": [],
    }


def _canonicalize_and_ensure_set(db: Session, raw: str) -> str:
    """
    Resolve using the same cache as /sets/{set_num}, then ensure a SetModel row exists
    so FK + joins in reviews work.
    """
    raw = (raw or "").strip()
    if not raw:
        raise HTTPException(status_code=400, detail="missing_set_num")

    s = get_set_by_num(raw)
    if not s:
        raise HTTPException(status_code=404, detail="set_not_found")

    canonical = str(s.get("set_num") or "").strip()
    if not canonical:
        raise HTTPException(status_code=404, detail="set_not_found")

    # Ensure DB row exists (FK requires this)
    row = db.execute(select(SetModel).where(SetModel.set_num == canonical).limit(1)).scalar_one_or_none()
    if row is None:
        row = SetModel(
            set_num=canonical,
            name=str(s.get("name") or "").strip() or canonical,
            year=s.get("year"),
            theme=str(s.get("theme") or ""),
            pieces=s.get("pieces"),
            image_url=str(s.get("image_url") or ""),
        )
        # If your Set model has set_num_plain, keep this guarded.
        if hasattr(row, "set_num_plain"):
            setattr(row, "set_num_plain", str(s.get("set_num_plain") or base_set_num(canonical)))

        db.add(row)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()  # someone else inserted concurrently
    else:
        # light backfill
        changed = False
        if not (row.name or "").strip() and s.get("name"):
            row.name = str(s.get("name") or "")
            changed = True
        if not (row.image_url or "").strip() and s.get("image_url"):
            row.image_url = str(s.get("image_url") or "")
            changed = True
        if changed:
            db.commit()

    return canonical


def _get_set_image_url(db: Session, canonical_set_num: str) -> Optional[str]:
    return db.execute(
        select(SetModel.image_url).where(SetModel.set_num == canonical_set_num)
    ).scalar_one_or_none()


# ---------------- endpoints ----------------

# ✅ Put this FIRST so it never collides with "/{set_num}"
# GET /sets/reviews/me
@router.get("/reviews/me", response_model=List[MyReviewItem])
def list_my_reviews(
    limit: int = 200,
    offset: int = 0,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    rows = db.execute(
        select(ReviewModel, SetModel.name, SetModel.image_url)
        .outerjoin(ReviewModel.set)  # relationship join
        .where(ReviewModel.user_id == current_user.id)
        .order_by(func.coalesce(ReviewModel.updated_at, ReviewModel.created_at).desc())
        .offset(int(offset))
        .limit(int(limit))
    ).all()

    out: List[Dict[str, Any]] = []
    for (r, set_name, image_url) in rows:
        out.append(
            {
                "set_num": r.set_num,
                "set_name": set_name,
                "image_url": image_url,
                "rating": float(r.rating) if r.rating is not None else None,
                "text": r.text,
                "created_at": r.created_at,
                "updated_at": getattr(r, "updated_at", None),
            }
        )
    return out


# GET /sets/{set_num}/reviews
@router.get("/{set_num}/reviews", response_model=List[Review])
def list_reviews_for_set(
    set_num: str,
    limit: int = 50,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    canonical = _canonicalize_and_ensure_set(db, set_num)

    rows = db.execute(
        select(ReviewModel, UserModel.username, SetModel.image_url)
        .join(ReviewModel.user)       # relationship join
        .outerjoin(ReviewModel.set)   # relationship join
        .where(ReviewModel.set_num == canonical)
        .order_by(func.coalesce(ReviewModel.updated_at, ReviewModel.created_at).desc())
        .limit(int(limit))
    ).all()

    return [_review_to_dict(r, username, image_url) for (r, username, image_url) in rows]


# POST /sets/{set_num}/reviews
@router.post("/{set_num}/reviews", response_model=Review)
def create_or_update_review(
    set_num: str,
    payload: ReviewCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    canonical = _canonicalize_and_ensure_set(db, set_num)
    image_url = _get_set_image_url(db, canonical)

    existing = db.execute(
        select(ReviewModel).where(
            ReviewModel.user_id == current_user.id,
            ReviewModel.set_num == canonical,
        )
    ).scalar_one_or_none()

    if existing is not None:
        if payload.rating is not None:
            existing.rating = payload.rating
        if payload.text is not None:
            existing.text = payload.text

        existing.updated_at = datetime.utcnow()
        db.commit()
        db.refresh(existing)
        return _review_to_dict(existing, current_user.username, image_url)

    new_row = ReviewModel(
        user_id=current_user.id,
        set_num=canonical,
        rating=payload.rating,
        text=payload.text,
        updated_at=datetime.utcnow(),
    )
    db.add(new_row)
    db.commit()
    db.refresh(new_row)
    return _review_to_dict(new_row, current_user.username, image_url)


# DELETE /sets/{set_num}/reviews/me
@router.delete("/{set_num}/reviews/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_review(
    set_num: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    # Canonicalize via cache; treat unknown set as idempotent success
    try:
        canonical = _canonicalize_and_ensure_set(db, set_num)
    except HTTPException as e:
        if e.status_code == 404 and e.detail == "set_not_found":
            return Response(status_code=status.HTTP_204_NO_CONTENT)
        raise

    (
        db.query(ReviewModel)
        .filter(
            ReviewModel.user_id == current_user.id,
            ReviewModel.set_num == canonical,
        )
        .delete(synchronize_session=False)
    )
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)