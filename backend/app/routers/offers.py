from fastapi import APIRouter
from app.data.offers import get_offers_for_set

router = APIRouter(prefix="/offers", tags=["offers"])

@router.get("/{plain_set_num}")
def offers_for_set(plain_set_num: str):
    # returns [] until you have real data
    return get_offers_for_set(plain_set_num)