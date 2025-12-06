from datetime import datetime
from typing import List, Dict, Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status

from ..core.auth import User, get_current_user
from ..data.reviews import REVIEWS
from ..schemas.review import Review, ReviewCreate

router = APIRouter()


def _find_review_for_user(set_num: str, username: str) -> Optional[Dict[str, Any]]:
    """Return the existing review dict for this user+set, or None."""
    for r in REVIEWS:
        if r["set_num"] == set_num and r["user"] == username:
            return r
    return None


@router.get("/{set_num}/reviews", response_model=List[Review])
def list_reviews_for_set(set_num: str, limit: int = 50) -> List[Dict[str, Any]]:
    """
    GET /sets/{set_num}/reviews?limit=50

    Always returns 200 OK with a list (possibly empty) of reviews
    for this set, newest first.
    """
    filtered = [r for r in REVIEWS if r["set_num"] == set_num]
    filtered.sort(key=lambda r: r["created_at"], reverse=True)
    return filtered[:limit]


@router.post("/{set_num}/reviews", response_model=Review)
def create_or_update_review(
    set_num: str,
    payload: ReviewCreate,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    POST /sets/{set_num}/reviews

    - If this user has NOT reviewed this set yet → create a new review.
    - If they HAVE reviewed it → update their existing review
      (rating and/or text).
    """
    username = current_user.username
    now = datetime.utcnow()

    existing = _find_review_for_user(set_num, username)

    if existing:
        # Update existing review
        if payload.rating is not None:
            existing["rating"] = payload.rating
        if payload.text is not None:
            existing["text"] = payload.text
        existing["updated_at"] = now
        return existing

    # No existing review → create
    new_review: Dict[str, Any] = {
        "id": len(REVIEWS) + 1,
        "set_num": set_num,
        "user": username,
        "rating": payload.rating,
        "text": payload.text,
        "created_at": now,
        "likes_count": 0,
        "liked_by": [],
    }
    REVIEWS.append(new_review)
    return new_review


@router.delete(
    "/{set_num}/reviews/me",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_my_review(
    set_num: str,
    current_user: User = Depends(get_current_user),
) -> None:
    """
    DELETE /sets/{set_num}/reviews/me

    Delete ONLY the current user's review for this set.
    """
    username = current_user.username

    for idx, r in enumerate(REVIEWS):
        if r["set_num"] == set_num and r["user"] == username:
            del REVIEWS[idx]
            return

    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Review not found",
    )