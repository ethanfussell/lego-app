# app/routers/reviews.py
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, status

from ..core.auth import User, get_current_user
from ..data.reviews import REVIEWS
from ..schemas.review import Review, ReviewCreate

router = APIRouter()


# ----------------- Helpers -----------------


def _find_review_for_user(set_num: str, username: str) -> dict | None:
    for r in REVIEWS:
        if r["set_num"] == set_num and r["user"] == username:
            return r
    return None


def _reviews_for_set(set_num: str) -> List[dict]:
    return [r for r in REVIEWS if r["set_num"] == set_num]


def _rating_summary_for_set(set_num: str) -> dict:
    """
    Compute a simple rating summary for a set:
    - average_rating (or None if no ratings yet)
    - rating_count
    """
    reviews = [
        r for r in REVIEWS
        if r["set_num"] == set_num and r.get("rating") is not None
    ]
    if not reviews:
        return {
            "set_num": set_num,
            "average_rating": None,
            "rating_count": 0,
        }

    total = sum(float(r["rating"]) for r in reviews)
    count = len(reviews)
    avg = round(total / count, 2)

    return {
        "set_num": set_num,
        "average_rating": avg,
        "rating_count": count,
    }


# ----------------- Routes -----------------


@router.get("/sets/{set_num}/reviews", response_model=List[Review])
def list_reviews_for_set(
    set_num: str,
    limit: int = Query(50, ge=1, le=200),
):
    """
    List reviews for a set, newest first.

    Frontend calls:
      GET /sets/{set_num}/reviews?limit=50
    """
    reviews = _reviews_for_set(set_num)
    # newest first by created_at
    reviews.sort(key=lambda r: r["created_at"], reverse=True)
    return reviews[:limit]


@router.get("/sets/{set_num}/rating")
def get_rating_summary(set_num: str):
    """
    Simple rating summary for a set.

    Frontend calls:
      GET /sets/{set_num}/rating
    """
    return _rating_summary_for_set(set_num)


@router.post("/sets/{set_num}/reviews", response_model=Review)
def create_or_update_review(
    set_num: str,
    payload: ReviewCreate,
    current_user: User = Depends(get_current_user),
):
    """
    Create *or update* the current user's review for a set.

    - If the user already has a review for that set, we update rating/text
      instead of returning 409.
    - Otherwise we create a new review.
    """
    username = current_user.username
    now = datetime.utcnow()

    existing = _find_review_for_user(set_num, username)

    if existing:
        # 🔁 UPDATE EXISTING REVIEW
        if payload.rating is not None:
            existing["rating"] = payload.rating
        if payload.text is not None:
            existing["text"] = payload.text

        # keep original created_at if present
        existing.setdefault("created_at", now)
        existing["updated_at"] = now

        return existing  # 200 OK

    # 🆕 NO EXISTING REVIEW → CREATE
    new_id = (max((r["id"] for r in REVIEWS), default=0)) + 1

    new_review = {
        "id": new_id,
        "set_num": set_num,
        "user": username,
        "rating": payload.rating,
        "text": payload.text,
        "created_at": now,
        "likes_count": 0,
        "liked_by": [],
    }
    REVIEWS.append(new_review)
    return new_review  # 200 OK or you could set status_code=201