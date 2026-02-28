# backend/app/routers/offers.py
from fastapi import APIRouter
from app.data.offers import get_offers_for_set

router = APIRouter(tags=["offers"])

@router.get("/offers/{plain_set_num}")
def offers_for_plain_set(plain_set_num: str):
    return get_offers_for_set(plain_set_num)

@router.get("/sets/{set_num}/offers")
def offers_for_set(set_num: str):
    plain = set_num.split("-")[0]  # "10497-1" -> "10497"
    return get_offers_for_set(plain)