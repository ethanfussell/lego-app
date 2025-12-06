# backend/app/routers/reviews.py
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from difflib import SequenceMatcher  # (still imported if you use elsewhere)
from fastapi import APIRouter, HTTPException, Query, Response, status
from pydantic import BaseModel, conint

from ..data.sets import get_set_by_num
from ..data.reviews import REVIEWS
from ..schemas.review import (
    Review,
    ReviewCreate,
    ReviewUpdate,
    ActorPayload,
    RatingSummary,
)

router = APIRouter()


# -------- helpers --------
def _set_exists(set_num: str) -> bool:
    # Accepts "10305" or "10305-1"
    return get_set_by_num(set_num) is not None


def _next_review_id() -> int:
    return max((r["id"] for r in REVIEWS), default=0) + 1


def _get_review(set_num: str, review_id: int) -> dict | None:
    for r in REVIEWS:
        if r["set_num"] == set_num and r["id"] == review_id:
            return r
    return None


def _review_by_user(set_num: str, user: str) -> dict | None:
    for r in REVIEWS:
        if r["set_num"] == set_num and r["user"] == user:
            return r
    return None

def _rating_summary_for_set(set_num: str) -> RatingSummary:
    """
    Compute average rating and count for a set.
    Only reviews that actually have a rating are used.
    Average is rounded to 1 decimal place.
    """
    ratings = [
        float(r["rating"])
        for r in REVIEWS
        if r["set_num"] == set_num and r.get("rating") is not None
    ]

    if not ratings:
        return RatingSummary(set_num=set_num, average=None, count=0)

    avg = round(sum(ratings) / len(ratings), 1)
    return RatingSummary(set_num=set_num, average=avg, count=len(ratings))


# -------- rating summary (avg + count) --------
@router.get("/{set_num}/rating-summary", response_model=RatingSummary)
def rating_summary(set_num: str) -> RatingSummary:
    """
    Return aggregate rating information for a set:
    - average rating across all reviews that have a rating
    - count of reviews that have a rating

    Average is rounded to 1 decimal place (e.g. 4.3).
    """
    if not _set_exists(set_num):
        raise HTTPException(status_code=404, detail="Set not found")

    rated_rows = [
        r for r in REVIEWS
        if r["set_num"] == set_num and r.get("rating") is not None
    ]

    count = len(rated_rows)
    if count == 0:
        return RatingSummary(set_num=set_num, average=None, count=0)

    total = sum(float(r["rating"]) for r in rated_rows)
    avg = round(total / count, 1)  # 1 decimal place

    return RatingSummary(set_num=set_num, average=avg, count=count)


# -------- LIST REVIEWS (with sorting + pagination) --------
@router.get("/{set_num}/reviews", response_model=List[Review])
def list_reviews(
    set_num: str,
    page: conint(ge=1) = Query(1, description="Page number (1-based)"),
    limit: conint(ge=1, le=100) = Query(10, description="Page size (1–100)"),
    sort: Optional[str] = Query(
        "newest", description="Sort by: newest | oldest | rating | likes"
    ),
    order: Optional[str] = Query(
        None, description="asc | desc (optional; sensible defaults)"
    ),
    response: Response = None,
):
    if not _set_exists(set_num):
        raise HTTPException(status_code=404, detail="Set not found")

    rows = [r for r in REVIEWS if r["set_num"] == set_num]

    # ---- sorting ----
    allowed = {"newest", "oldest", "rating", "likes"}
    if sort not in allowed:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid sort '{sort}'. Allowed: newest, oldest, rating, likes",
        )

    # defaults per sort if order not supplied
    if order is None:
        order = "desc" if sort in {"newest", "rating", "likes"} else "asc"
    reverse = order == "desc"

    if sort in {"newest", "oldest"}:
        rows.sort(key=lambda r: r["created_at"], reverse=reverse)
    elif sort == "rating":
        # if rating is None, treat as 0 for sorting
        rows.sort(
            key=lambda r: (r.get("rating") or 0, r["created_at"]), reverse=reverse
        )
    elif sort == "likes":
        rows.sort(
            key=lambda r: (r.get("likes_count") or 0, r["created_at"]),
            reverse=reverse,
        )

    # ---- pagination ----
    total = len(rows)
    start = (page - 1) * limit
    end = start + limit
    page_rows = rows[start:end]

    if response is not None:
        response.headers["X-Total-Count"] = str(total)

    return page_rows

@router.get("/{set_num}/rating-summary", response_model=RatingSummary)
def get_rating_summary(set_num: str):
    """
    Returns an aggregate rating summary for a set:
    - average rating (1 decimal) or None if no ratings
    - count of reviews that have a rating
    """
    if not _set_exists(set_num):
        raise HTTPException(status_code=404, detail="Set not found")

    return _rating_summary_for_set(set_num)


# -------- CREATE REVIEW --------
@router.post(
    "/{set_num}/reviews",
    status_code=status.HTTP_201_CREATED,
    response_model=Review,
)
def create_review(set_num: str, payload: ReviewCreate):
    if not _set_exists(set_num):
        raise HTTPException(status_code=404, detail="Set not found")

    # Prevent duplicate review by same user on same set
    existing = _review_by_user(set_num, payload.user)
    if existing:
        raise HTTPException(
            status_code=409,
            detail="User already reviewed this set. Use PUT to edit the existing review.",
        )

    username = payload.user or "Anonymous"
    
    obj = {
        "id": _next_review_id(),
        "set_num": set_num,
        "rating": payload.rating,
        "text": payload.text,
        "user": payload.user,
        "created_at": datetime.utcnow(),
        "likes_count": 0,
        "liked_by": [],
    }
    REVIEWS.append(obj)
    return obj


# -------- UPDATE (edit) --------
@router.put("/{set_num}/reviews/{review_id}", response_model=Review)
def update_review(set_num: str, review_id: int, payload: ReviewUpdate):
    if not _set_exists(set_num):
        raise HTTPException(status_code=404, detail="Set not found")

    r = _get_review(set_num, review_id)
    if not r:
        raise HTTPException(status_code=404, detail="Review not found")

    # simple auth stand-in: only author can edit
    if payload.user != r["user"]:
        raise HTTPException(
            status_code=403, detail="Only the author can edit this review"
        )

    if payload.rating is not None:
        r["rating"] = payload.rating
    if payload.text is not None:
        r["text"] = payload.text

    return r


# -------- DELETE ----------
@router.delete("/{set_num}/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(set_num: str, review_id: int, payload: ActorPayload):
    if not _set_exists(set_num):
        raise HTTPException(status_code=404, detail="Set not found")

    r = _get_review(set_num, review_id)
    if not r:
        raise HTTPException(status_code=404, detail="Review not found")

    # simple auth stand-in: only author can delete
    if payload.user != r["user"]:
        raise HTTPException(
            status_code=403, detail="Only the author can delete this review"
        )

    REVIEWS.remove(r)
    return


# -------- LIKE / UNLIKE REVIEW --------
class LikePayload(BaseModel):
    user: str  # temporary until auth (JWT) is added


@router.post(
    "/{set_num}/reviews/{review_id}/like",
    status_code=status.HTTP_204_NO_CONTENT,
)
def like_review(set_num: str, review_id: int, payload: LikePayload):
    r = _get_review(set_num, review_id)
    if not r:
        raise HTTPException(status_code=404, detail="Review not found")

    if payload.user not in r["liked_by"]:
        r["liked_by"].append(payload.user)
        r["likes_count"] = len(r["liked_by"])
    return


@router.delete(
    "/{set_num}/reviews/{review_id}/like",
    status_code=status.HTTP_204_NO_CONTENT,
)
def unlike_review(set_num: str, review_id: int, payload: LikePayload):
    r = _get_review(set_num, review_id)
    if not r:
        raise HTTPException(status_code=404, detail="Review not found")

    if payload.user in r["liked_by"]:
        r["liked_by"].remove(payload.user)
        r["likes_count"] = len(r["liked_by"])
    return