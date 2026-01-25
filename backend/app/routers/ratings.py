# backend/app/routers/ratings.py
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, RelationshipProperty

from ..core.auth import get_current_user
from ..db import get_db
from ..models import User as UserModel

# IMPORTANT: match how your project imports Review in other routers.
# If this import fails, change it to whatever you use in sets.py.
from ..models import Review as ReviewModel  # <-- adjust if needed

router = APIRouter(prefix="/ratings", tags=["ratings"])


class RatingIn(BaseModel):
  rating: int = Field(..., ge=1, le=5)


def _assign_review_user(review: ReviewModel, user: UserModel) -> None:
  """
  Works whether ReviewModel.user is:
    - a relationship (Review.user -> UserModel), OR
    - a string column (Review.user == "ethan")
  """
  user_attr = getattr(ReviewModel, "user", None) or getattr(ReviewModel, "username", None)
  if user_attr is None:
    raise RuntimeError("ReviewModel missing user field (expected .user or .username)")

  prop = getattr(user_attr, "property", None)

  if isinstance(prop, RelationshipProperty):
    # Relationship: set the relationship directly
    setattr(review, user_attr.key, user)
    return

  # Plain string column: store username
  setattr(review, user_attr.key, user.username)


@router.put("/{set_num}")
def put_rating(
  set_num: str,
  payload: RatingIn,
  db: Session = Depends(get_db),
  user: UserModel = Depends(get_current_user),
):
  sn = (set_num or "").strip()
  if not sn:
    raise HTTPException(status_code=400, detail="Missing set_num")

  review = ReviewModel(set_num=sn, rating=float(payload.rating))
  _assign_review_user(review, user)

  db.add(review)
  db.commit()

  return {"ok": True, "set_num": sn, "user_rating": float(payload.rating)}