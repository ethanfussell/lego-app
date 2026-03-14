# backend/app/routers/ratings.py
from __future__ import annotations

import logging

from fastapi import APIRouter, Body, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, RelationshipProperty

from ..core.auth import get_current_user
from ..core.collections import move_wishlist_to_owned
from ..core.limiter import limiter
from ..db import get_db
from ..models import User as UserModel

from ..models import Review as ReviewModel

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ratings", tags=["ratings"])


class RatingIn(BaseModel):
  rating: float = Field(..., ge=0.5, le=5.0)

  def model_post_init(self, __context: object) -> None:
    # Snap to nearest 0.5
    self.rating = round(self.rating * 2) / 2


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
@limiter.limit("30/minute")
def put_rating(
  request: Request,
  set_num: str,
  payload: RatingIn = Body(...),
  db: Session = Depends(get_db),
  user: UserModel = Depends(get_current_user),
):
  sn = (set_num or "").strip()
  if not sn:
    raise HTTPException(status_code=400, detail="Missing set_num")

  # Upsert: update existing review if one exists, otherwise create new
  existing = db.execute(
    select(ReviewModel).where(
      ReviewModel.user_id == user.id,
      ReviewModel.set_num == sn,
    ).limit(1)
  ).scalar_one_or_none()

  if existing:
    existing.rating = float(payload.rating)
    review = existing
  else:
    review = ReviewModel(set_num=sn, rating=float(payload.rating))
    _assign_review_user(review, user)
    db.add(review)

  db.commit()

  # Auto-move from wishlist → owned when a user rates a set
  moved_to_owned = False
  try:
    moved_to_owned = move_wishlist_to_owned(db, int(user.id), sn)
  except Exception:
    logger.exception("Failed to move set %s from wishlist to owned", sn)

  return {
    "ok": True,
    "set_num": sn,
    "user_rating": float(payload.rating),
    "moved_to_owned": moved_to_owned,
  }


