# app/routers/reviews.py
from fastapi import APIRouter, HTTPException, status, Query, Response
from pydantic import conint
from typing import List
from datetime import datetime

from app.data.sets import SETS
from app.data.reviews import REVIEWS
from app.schemas.review import Review, ReviewCreate

router = APIRouter()

def _set_exists(set_num: str) -> bool:
    return any(s["set_num"] == set_num for s in SETS)

@router.get("/{set_num}/reviews", response_model=List[Review])
def list_reviews(
    set_num: str,
    page: conint(ge=1) = Query(1, description="Page number (1-based)"),
    limit: conint(ge=1, le=100) = Query(10, description="Page size (1–100)"),
    response: Response = None,
):
    if not _set_exists(set_num):
        raise HTTPException(status_code=404, detail="Set not found")

    rows = [r for r in REVIEWS if r["set_num"] == set_num]
    # newest first
    rows.sort(key=lambda r: r["created_at"], reverse=True)

    total = len(rows)
    start = (page - 1) * limit
    end = start + limit
    page_rows = rows[start:end]

    if response is not None:
        response.headers["X-Total-Count"] = str(total)

    return page_rows

@router.post("/{set_num}/reviews", status_code=status.HTTP_201_CREATED, response_model=Review)
def create_review(set_num: str, payload: ReviewCreate):
    if not _set_exists(set_num):
        raise HTTPException(status_code=404, detail="Set not found")

    review_id = (REVIEWS[-1]["id"] + 1) if REVIEWS else 1
    obj = {
        "id": review_id,
        "set_num": set_num,
        "rating": payload.rating,
        "text": payload.text,
        "user": payload.user,
        "created_at": datetime.utcnow(),
    }
    REVIEWS.append(obj)
    return obj