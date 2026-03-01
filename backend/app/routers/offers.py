# backend/app/routers/offers.py
from fastapi import APIRouter, Response
from app.data.offers import get_offers_for_set

router = APIRouter(tags=["offers"])

@router.get("/offers/{plain_set_num}")
def offers_for_plain_set(plain_set_num: str, response: Response):
    response.headers["x-offers-handler"] = "offers.offers_for_plain_set"
    return get_offers_for_set(plain_set_num)
