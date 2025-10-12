# app/routers/reviews.py
from fastapi import APIRouter, HTTPException, status
from typing import List
from datetime import datetime

from app.data.sets import SETS
from app.data.reviews import REVIEWS
from app.schemas.review import Review, ReviewCreate

router = APIRouter()

def _set_exists(set_num: str) -> bool:
    return any(s["set_num"] == set_num for s in SETS)

@router.get("/{set_num}/reviews", response_model=List[Review])
def list_reviews(set_num: str):
    if not _set_exists(set_num):
        raise HTTPException(status_code=404, detail="Set not found")
    return [r for r in REVIEWS if r["set_num"] == set_num]

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