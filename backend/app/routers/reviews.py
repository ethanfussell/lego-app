# app/routers/reviews.py
from datetime import datetime, UTC
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status

from ..core.auth import User, get_current_user
from ..data.reviews import REVIEWS  # simple in-memory store
from ..schemas.review import Review, ReviewCreate

router = APIRouter()


def _now_utc():
    return datetime.now(UTC)


def _next_review_id() -> int:
    return max((r["id"] for r in REVIEWS), default=0) + 1


@router.get("/{set_num}/reviews", response_model=List[Review])
def list_reviews_for_set(set_num: str, limit: int = 50) -> List[dict]:
    """
    Get up to `limit` most recent reviews for a set.

    IMPORTANT: This should *not* 404 when there are no reviews.
               We just return [] with 200.
    """
    filtered = [r for r in REVIEWS if r["set_num"] == set_num]
    filtered.sort(key=lambda r: r["created_at"], reverse=True)
    return filtered[:limit]


@router.post(
    "/{set_num}/reviews",
    response_model=Review,
    status_code=status.HTTP_201_CREATED,
)
def create_review_for_set(
    set_num: str,
    payload: ReviewCreate,
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Create a new review (rating-only, text-only, or both) for the current user.

    - `user` ALWAYS comes from the token (`current_user.username`)
    - Optional: only allow one review per user per set → 409 Conflict
    """

    username = current_user.username

    # Optional: only one review per user per set
    for r in REVIEWS:
        if r["set_num"] == set_num and r["user"] == username:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="You have already reviewed this set.",
            )

    review = {
        "id": _next_review_id(),
        "set_num": set_num,
        "user": username,                 # ✅ never None
        "rating": payload.rating,
        "text": payload.text,
        "created_at": _now_utc(),
        "likes_count": 0,
        "liked_by": [],
    }

    REVIEWS.append(review)
    return review