# backend/app/routers/reviews.py

from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, Response, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select, func, case
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ..core.auth import get_current_user, get_current_user_optional
from ..core.collections import move_wishlist_to_owned
from ..core.limiter import limiter
from ..core.sanitize import contains_profanity
from ..core.set_nums import base_set_num
from ..data.sets import get_set_by_num
from ..db import get_db
from ..routers.sets import invalidate_ratings_cache
from ..models import Review as ReviewModel
from ..models import ReviewVote as ReviewVoteModel
from ..models import Set as SetModel
from ..models import User as UserModel
from ..schemas.review import Review, ReviewCreate, MyReviewItem

import logging

logger = logging.getLogger(__name__)

# NOTE: this router is mounted with prefix="/sets" in main.py
router = APIRouter(tags=["reviews"])


# ---------------- helpers ----------------

def _vote_counts_for_reviews(
    db: Session, review_ids: List[int], current_user_id: Optional[int] = None
) -> Dict[int, Dict[str, Any]]:
    """Batch-fetch vote counts + current user's vote for a list of review IDs."""
    if not review_ids:
        return {}

    # Aggregate up/down counts per review
    rows = db.execute(
        select(
            ReviewVoteModel.review_id,
            func.count(case((ReviewVoteModel.vote_type == "up", 1))).label("upvotes"),
            func.count(case((ReviewVoteModel.vote_type == "down", 1))).label("downvotes"),
        )
        .where(ReviewVoteModel.review_id.in_(review_ids))
        .group_by(ReviewVoteModel.review_id)
    ).all()

    result: Dict[int, Dict[str, Any]] = {
        rid: {"upvotes": 0, "downvotes": 0, "user_vote": None} for rid in review_ids
    }
    for review_id, up, down in rows:
        result[review_id] = {"upvotes": up, "downvotes": down, "user_vote": None}

    # If we have a current user, also fetch their votes
    if current_user_id is not None:
        user_votes = db.execute(
            select(ReviewVoteModel.review_id, ReviewVoteModel.vote_type)
            .where(
                ReviewVoteModel.review_id.in_(review_ids),
                ReviewVoteModel.user_id == current_user_id,
            )
        ).all()
        for review_id, vote_type in user_votes:
            if review_id in result:
                result[review_id]["user_vote"] = vote_type

    return result


def _review_to_dict(
    r: ReviewModel,
    username: str,
    image_url: Optional[str],
    vote_info: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    vi = vote_info or {"upvotes": 0, "downvotes": 0, "user_vote": None}
    return {
        "id": int(r.id),
        "set_num": r.set_num,
        "user": username,
        "rating": float(r.rating) if r.rating is not None else None,
        "text": r.text,
        "image_url": image_url,
        "created_at": r.created_at,
        "updated_at": getattr(r, "updated_at", None),
        "upvotes": vi["upvotes"],
        "downvotes": vi["downvotes"],
        "user_vote": vi["user_vote"],
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


# ---------------- Vote schema ----------------

class VoteCreate(BaseModel):
    vote_type: str

    @field_validator("vote_type")
    @classmethod
    def validate_vote_type(cls, v: str) -> str:
        if v not in ("up", "down"):
            raise ValueError("vote_type must be 'up' or 'down'")
        return v


# ---------------- endpoints ----------------

# ✅ Put this FIRST so it never collides with "/{set_num}"
# GET /sets/reviews/me
@router.get("/reviews/me", response_model=List[MyReviewItem])
def list_my_reviews(
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    rows = db.execute(
        select(ReviewModel, SetModel.name, SetModel.image_url)
        .outerjoin(ReviewModel.set)  # relationship join
        .where(ReviewModel.user_id == current_user.id)
        .order_by(func.coalesce(ReviewModel.updated_at, ReviewModel.created_at).desc())
        .offset(offset)
        .limit(limit)
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
    limit: int = Query(default=50, ge=1, le=200),
    current_user: Optional[UserModel] = Depends(get_current_user_optional),
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

    review_ids = [r.id for (r, _, _) in rows]
    user_id = current_user.id if current_user else None
    vote_map = _vote_counts_for_reviews(db, review_ids, user_id)

    return [
        _review_to_dict(r, username, image_url, vote_map.get(r.id))
        for (r, username, image_url) in rows
    ]


# POST /sets/{set_num}/reviews
@router.post("/{set_num}/reviews", response_model=Review)
@limiter.limit("20/minute")
def create_or_update_review(
    request: Request,
    set_num: str,
    payload: ReviewCreate = Body(...),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    canonical = _canonicalize_and_ensure_set(db, set_num)
    image_url = _get_set_image_url(db, canonical)

    # Profanity check on review text
    if payload.text and contains_profanity(payload.text):
        raise HTTPException(
            status_code=400,
            detail="review_contains_inappropriate_language",
        )

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
        invalidate_ratings_cache()

        # Auto-move wishlist → owned when a rating is set
        if payload.rating is not None:
            try:
                move_wishlist_to_owned(db, current_user.id, canonical)
            except Exception:
                logger.exception("Failed to move set %s from wishlist to owned", canonical)

        vote_map = _vote_counts_for_reviews(db, [existing.id], current_user.id)
        return _review_to_dict(existing, current_user.username, image_url, vote_map.get(existing.id))

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
    invalidate_ratings_cache()

    # Auto-move wishlist → owned when a rating is set
    if payload.rating is not None:
        try:
            move_wishlist_to_owned(db, current_user.id, canonical)
        except Exception:
            logger.exception("Failed to move set %s from wishlist to owned", canonical)

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

    from sqlalchemy import delete as sa_delete
    db.execute(
        sa_delete(ReviewModel).where(
            ReviewModel.user_id == current_user.id,
            ReviewModel.set_num == canonical,
        )
    )
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


# -------------------- Vote endpoints --------------------

# POST /sets/{set_num}/reviews/{review_id}/vote
@router.post("/{set_num}/reviews/{review_id}/vote")
@limiter.limit("30/minute")
def vote_on_review(
    request: Request,
    set_num: str,
    review_id: int,
    payload: VoteCreate = Body(...),
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    # Verify the review exists
    review = db.execute(
        select(ReviewModel).where(ReviewModel.id == review_id)
    ).scalar_one_or_none()

    if review is None:
        raise HTTPException(status_code=404, detail="review_not_found")

    # Don't allow voting on your own review
    if review.user_id == current_user.id:
        raise HTTPException(status_code=400, detail="cannot_vote_own_review")

    # Check for existing vote
    existing_vote = db.execute(
        select(ReviewVoteModel).where(
            ReviewVoteModel.review_id == review_id,
            ReviewVoteModel.user_id == current_user.id,
        )
    ).scalar_one_or_none()

    if existing_vote is not None:
        if existing_vote.vote_type == payload.vote_type:
            # Same vote type → toggle off (remove vote)
            db.delete(existing_vote)
            db.commit()
        else:
            # Different vote type → update
            existing_vote.vote_type = payload.vote_type
            db.commit()
    else:
        # New vote
        new_vote = ReviewVoteModel(
            review_id=review_id,
            user_id=current_user.id,
            vote_type=payload.vote_type,
        )
        db.add(new_vote)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()

    # Return updated counts
    vote_map = _vote_counts_for_reviews(db, [review_id], current_user.id)
    vi = vote_map.get(review_id, {"upvotes": 0, "downvotes": 0, "user_vote": None})
    return {
        "review_id": review_id,
        "upvotes": vi["upvotes"],
        "downvotes": vi["downvotes"],
        "user_vote": vi["user_vote"],
    }


# DELETE /sets/{set_num}/reviews/{review_id}/vote
@router.delete("/{set_num}/reviews/{review_id}/vote", status_code=status.HTTP_204_NO_CONTENT)
def remove_vote(
    set_num: str,
    review_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    from sqlalchemy import delete as sa_delete
    db.execute(
        sa_delete(ReviewVoteModel).where(
            ReviewVoteModel.review_id == review_id,
            ReviewVoteModel.user_id == current_user.id,
        )
    )
    db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)
