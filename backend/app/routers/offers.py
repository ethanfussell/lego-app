# backend/app/routers/offers.py
from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from app.data.offers import get_offers_for_set, get_msrp_for_set
from app.db import get_db

router = APIRouter(tags=["offers"])


@router.get("/offers/{plain_set_num}")
def offers_for_plain_set(
    plain_set_num: str,
    response: Response,
    db: Session = Depends(get_db),
):
    response.headers["x-offers-handler"] = "offers.offers_for_plain_set"
    offers = get_offers_for_set(db, plain_set_num)
    msrp = get_msrp_for_set(db, plain_set_num)

    return {
        "offers": offers,
        "msrp": msrp,
    }
