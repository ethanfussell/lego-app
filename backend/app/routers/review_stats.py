# backend/app/routers/review_stats.py
from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..core.auth import get_current_user
from ..db import get_db
from ..models import Review as ReviewModel
from ..models import Set as SetModel
from ..models import User as UserModel
from ..schemas.review import ReviewStats

# ✅ remove prefix here
router = APIRouter(tags=["reviews"])


# ✅ keep this as /me/stats
@router.get("/me/stats", response_model=ReviewStats)
def get_my_review_stats(
    current_user: UserModel = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    user_id = int(current_user.id)

    total_reviews = db.execute(
        select(func.count()).select_from(ReviewModel).where(ReviewModel.user_id == user_id)
    ).scalar_one()

    rated_reviews = db.execute(
        select(func.count())
        .select_from(ReviewModel)
        .where(ReviewModel.user_id == user_id, ReviewModel.rating.isnot(None))
    ).scalar_one()

    avg_rating = db.execute(
        select(func.avg(ReviewModel.rating))
        .where(ReviewModel.user_id == user_id, ReviewModel.rating.isnot(None))
    ).scalar_one()

    avg_rating_out = float(avg_rating) if avg_rating is not None else None

    hist_rows = db.execute(
        select(ReviewModel.rating, func.count())
        .where(ReviewModel.user_id == user_id, ReviewModel.rating.isnot(None))
        .group_by(ReviewModel.rating)
        .order_by(ReviewModel.rating.asc())
    ).all()

    histogram: Dict[str, int] = {}
    for (rating_val, ct) in hist_rows:
        key = f"{float(rating_val):.1f}"
        histogram[key] = int(ct)

    recent_rows = db.execute(
        select(
            ReviewModel.set_num,
            SetModel.name,
            ReviewModel.rating,
            ReviewModel.text,
            ReviewModel.created_at,
        )
        .join(SetModel, SetModel.set_num == ReviewModel.set_num)
        .where(ReviewModel.user_id == user_id)
        .order_by(ReviewModel.created_at.desc())
        .limit(10)
    ).all()

    recent = []
    for (set_num, set_name, rating, text, created_at) in recent_rows:
        recent.append(
            {
                "set_num": set_num,
                "set_name": set_name,
                "rating": float(rating) if rating is not None else None,
                "text": text,
                "created_at": created_at,
            }
        )

    return {
        "total_reviews": int(total_reviews),
        "rated_reviews": int(rated_reviews),
        "avg_rating": avg_rating_out,
        "rating_histogram": histogram,
        "recent": recent,
    }