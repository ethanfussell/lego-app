# app/routers/reviews.py
from fastapi import APIRouter, HTTPException, status, Query, Response
from pydantic import conint, BaseModel
from typing import List, Optional
from datetime import datetime

from app.data.sets import SETS
from app.data.reviews import REVIEWS
from app.schemas.review import Review, ReviewCreate, ReviewUpdate, ActorPayload

router = APIRouter()

def _set_exists(set_num: str) -> bool:
    return any(s["set_num"] == set_num for s in SETS)

def _next_review_id() -> int:
    return (max((r["id"] for r in REVIEWS), default=0) + 1)

def _review_by_user(set_num: str, user: str) -> dict | None:
    for r in REVIEWS:
        if r["set_num"] == set_num and r["user"] == user:
            return r
    return None

# -------- LIST REVIEWS (with sorting + pagination) --------
@router.get("/{set_num}/reviews", response_model=List[Review])
def list_reviews(
    set_num: str,
    page: conint(ge=1) = Query(1, description="Page number (1-based)"),
    limit: conint(ge=1, le=100) = Query(10, description="Page size (1–100)"),
    sort: Optional[str] = Query("newest", description="Sort by: newest | oldest | rating | likes"),
    order: Optional[str] = Query(None, description="asc | desc (optional; sensible defaults)"),
    response: Response = None,
):
    if not _set_exists(set_num):
        raise HTTPException(status_code=404, detail="Set not found")

    rows = [r for r in REVIEWS if r["set_num"] == set_num]

    # ---- sorting ----
    allowed = {"newest", "oldest", "rating", "likes"}
    if sort not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid sort '{sort}'. Allowed: newest, oldest, rating, likes")

    # defaults per sort if order not supplied
    if order is None:
        order = "desc" if sort in {"newest", "rating", "likes"} else "asc"
    reverse = (order == "desc")

    if sort in {"newest", "oldest"}:
        # created_at is datetime; order controls direction
        rows.sort(key=lambda r: r["created_at"], reverse=reverse)
    elif sort == "rating":
        # tie-break by recency
        rows.sort(key=lambda r: (r.get("rating") or 0, r["created_at"]), reverse=reverse)
    elif sort == "likes":
        # tie-break by recency
        rows.sort(key=lambda r: (r.get("likes_count") or 0, r["created_at"]), reverse=reverse)

    # ---- pagination ----
    total = len(rows)
    start = (page - 1) * limit
    end = start + limit
    page_rows = rows[start:end]

    if response is not None:
        response.headers["X-Total-Count"] = str(total)

    return page_rows

# -------- CREATE REVIEW --------
@router.post("/{set_num}/reviews", status_code=status.HTTP_201_CREATED, response_model=Review)
def create_review(set_num: str, payload: ReviewCreate):
    if not _set_exists(set_num):
        raise HTTPException(status_code=404, detail="Set not found")
    
    # Prevent duplicate review by same user on same set
    existing = _review_by_user(set_num, payload.user)
    if existing:
        raise HTTPException(
            status_code=409,
            detail="User already reviewed this set. Use PUT to edit the existing review."
        )

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
        raise HTTPException(status_code=403, detail="Only the author can edit this review")

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
        raise HTTPException(status_code=403, detail="Only the author can delete this review")

    REVIEWS.remove(r)
    return

# -------- LIKE / UNLIKE REVIEW --------
class LikePayload(BaseModel):
    user: str  # temporary until auth (JWT) is added

def _get_review(set_num: str, review_id: int) -> dict | None:
    for r in REVIEWS:
        if r["set_num"] == set_num and r["id"] == review_id:
            return r
    return None

@router.post("/{set_num}/reviews/{review_id}/like", status_code=status.HTTP_204_NO_CONTENT)
def like_review(set_num: str, review_id: int, payload: LikePayload):
    r = _get_review(set_num, review_id)
    if not r:
        raise HTTPException(status_code=404, detail="Review not found")
    if payload.user not in r["liked_by"]:
        r["liked_by"].append(payload.user)
        r["likes_count"] = len(r["liked_by"])
    return

@router.delete("/{set_num}/reviews/{review_id}/like", status_code=status.HTTP_204_NO_CONTENT)
def unlike_review(set_num: str, review_id: int, payload: LikePayload):
    r = _get_review(set_num, review_id)
    if not r:
        raise HTTPException(status_code=404, detail="Review not found")
    if payload.user in r["liked_by"]:
        r["liked_by"].remove(payload.user)
        r["likes_count"] = len(r["liked_by"])
    return