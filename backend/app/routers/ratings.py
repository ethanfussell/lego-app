# backend/app/routers/ratings.py
from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session, RelationshipProperty

from ..core.auth import get_current_user
from ..db import get_db
from ..models import User as UserModel
from ..models import List as ListModel
from ..models import ListItem as ListItemModel

# IMPORTANT: match how your project imports Review in other routers.
# If this import fails, change it to whatever you use in sets.py.
from ..models import Review as ReviewModel  # <-- adjust if needed

logger = logging.getLogger(__name__)

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
    moved_to_owned = _move_wishlist_to_owned(db, int(user.id), sn)
  except Exception:
    logger.exception("Failed to move set %s from wishlist to owned", sn)

  return {
    "ok": True,
    "set_num": sn,
    "user_rating": float(payload.rating),
    "moved_to_owned": moved_to_owned,
  }


def _move_wishlist_to_owned(db: Session, user_id: int, set_num: str) -> bool:
  """If the set is on the user's wishlist, move it to owned. Returns True if moved."""
  from ..core.set_nums import base_set_num

  # Find wishlist
  wishlist = db.execute(
    select(ListModel).where(
      ListModel.owner_id == user_id,
      ListModel.is_system.is_(True),
      ListModel.system_key == "wishlist",
    ).limit(1)
  ).scalar_one_or_none()

  if not wishlist:
    return False

  # Check if set is on the wishlist (exact or base match)
  base = base_set_num(set_num)
  item = db.execute(
    select(ListItemModel).where(
      ListItemModel.list_id == int(wishlist.id),
      ListItemModel.set_num.in_([set_num, base, f"{base}-1"]),
    ).limit(1)
  ).scalar_one_or_none()

  if not item:
    return False

  # Remove from wishlist
  db.delete(item)

  # Get or create owned list
  owned_list = db.execute(
    select(ListModel).where(
      ListModel.owner_id == user_id,
      ListModel.is_system.is_(True),
      ListModel.system_key == "owned",
    ).limit(1)
  ).scalar_one_or_none()

  if not owned_list:
    from sqlalchemy import func
    max_pos = db.execute(
      select(func.coalesce(func.max(ListModel.position), -1))
      .where(ListModel.owner_id == user_id)
    ).scalar_one()
    owned_list = ListModel(
      owner_id=user_id,
      title="Owned",
      description=None,
      is_public=False,
      position=int(max_pos) + 1,
      is_system=True,
      system_key="owned",
    )
    db.add(owned_list)
    db.flush()

  # Add to owned if not already there
  already = db.execute(
    select(ListItemModel).where(
      ListItemModel.list_id == int(owned_list.id),
      ListItemModel.set_num == set_num,
    ).limit(1)
  ).scalar_one_or_none()

  if not already:
    from sqlalchemy import func
    max_pos = db.execute(
      select(func.coalesce(func.max(ListItemModel.position), -1))
      .where(ListItemModel.list_id == int(owned_list.id))
    ).scalar_one()
    db.add(ListItemModel(
      list_id=int(owned_list.id),
      set_num=set_num,
      position=int(max_pos) + 1,
    ))

  db.commit()
  return True