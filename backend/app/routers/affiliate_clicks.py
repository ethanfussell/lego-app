from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import AffiliateClick, User as UserModel
from app.schemas.affiliate import AffiliateClickIn
from app.core.auth import get_current_user_optional
from app.core.limiter import limiter

router = APIRouter(prefix="/events", tags=["events"])

@router.post("/affiliate-click")
@limiter.limit("30/minute")
def track_affiliate_click(
    request: Request,
    body: AffiliateClickIn,
    db: Session = Depends(get_db),
    current_user: UserModel | None = Depends(get_current_user_optional),
):
    row = AffiliateClick(
        user_id=(current_user.id if current_user else None),
        set_num=body.set_num,
        store=body.store,
        price=body.price,
        currency=body.currency,
        offer_rank=body.offer_rank,
        page_path=body.page_path,
    )
    db.add(row)
    db.commit()
    return {"ok": True}