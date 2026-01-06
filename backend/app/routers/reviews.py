# backend/app/routers/reviews.py
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..core.auth import get_current_user
from ..core.set_nums import resolve_set_num
from ..db import get_db
from ..models import Review as ReviewModel
from ..models import User as UserModel
from ..schemas.review import Review, ReviewCreate

router = APIRouter()


def _review_to_dict(r: ReviewModel, username: str) -> Dict[str, Any]:
    return {
        "id": int(r.id),
        "set_num": r.set_num,
        "user": username,
        "rating": float(r.rating) if r.rating is not None else None,
        "text": r.text,
        "created_at": r.created_at,
        "updated_at": getattr(r, "updated_at", None),
        "likes_count": 0,
        "liked_by": [],
    }


@router.get("/{set_num}/reviews", response_model=List[Review])
def list_reviews_for_set(
    set_num: str,
    limit: int = 50,
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    canonical = resolve_set_num(db, set_num)

    rows = db.execute(
        select(ReviewModel, UserModel.username)
        .join(UserModel, UserModel.id == ReviewModel.user_id)
        .where(ReviewModel.set_num == canonical)
        .order_by(ReviewModel.created_at.desc())
        .limit(int(limit))
    ).all()

    return [_review_to_dict(r, username) for (r, username) in rows]


@router.post("/{set_num}/reviews", response_model=Review)
def create_or_update_review(
    set_num: str,
    payload: ReviewCreate,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    canonical = resolve_set_num(db, set_num)

    existing = db.execute(
        select(ReviewModel)
        .where(
            ReviewModel.user_id == current_user.id,
            ReviewModel.set_num == canonical,
        )
        .limit(1)
    ).scalar_one_or_none()

    if existing:
        if payload.rating is not None:
            existing.rating = payload.rating
        if payload.text is not None:
            existing.text = payload.text

        # only works if/when you add + migrate updated_at
        if hasattr(existing, "updated_at"):
            setattr(existing, "updated_at", datetime.utcnow())

        db.commit()
        db.refresh(existing)
        return _review_to_dict(existing, current_user.username)

    new_row = ReviewModel(
        user_id=current_user.id,
        set_num=canonical,
        rating=payload.rating,
        text=payload.text,
    )

    db.add(new_row)
    db.commit()
    db.refresh(new_row)
    return _review_to_dict(new_row, current_user.username)


@router.delete("/{set_num}/reviews/me", status_code=status.HTTP_204_NO_CONTENT)
def delete_my_review(
    set_num: str,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """
    Idempotent delete:
    - If review exists -> delete + 204
    - If review already deleted -> 204
    - If set_num doesn't exist -> 204 (treat as already gone)
    """
    try:
        canonical = resolve_set_num(db, set_num)
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