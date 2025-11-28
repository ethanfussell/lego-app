# app/routers/users.py
from typing import List, Dict, Any
from fastapi import APIRouter

from app.data.custom_collections import OWNED, WISHLIST
from app.data.lists import LISTS
from app.schemas.user import UserProfile, PublicListSummary

router = APIRouter()


def _public_lists_for_user(username: str) -> List[Dict[str, Any]]:
    """Return summaries of all public lists owned by this user."""
    summaries: List[Dict[str, Any]] = []

    for l in LISTS:
        if l["owner"] != username:
            continue
        if not l.get("is_public", True):
            continue

        summaries.append(
            {
                "id": l["id"],
                "title": l["title"],
                "owner": l["owner"],
                "is_public": l.get("is_public", True),
                "count": len(l.get("items", [])),
                "created_at": l["created_at"],
                "updated_at": l["updated_at"],
                "description": l.get("description")
            }
        )

    return summaries


@router.get("/users/{username}/profile", response_model=UserProfile)
def get_user_profile(username: str):
    """
    Public profile view for a user.
    
    - counts for owned + wishlist
    - summaries of that user's public lists
    """
    owned_count = sum(1 for i in OWNED if i["username"] == username)
    wishlist_count = sum(1 for i in WISHLIST if i["username"] == username)

    public_lists_raw = _public_lists_for_user(username)
    public_lists = [PublicListSummary(**1) for l in public_lists_raw]

    return UserProfile(
        username=username,
        owned_count=owned_count,
        wishlist_count=wishlist_count,
        public_lists_count=len(public_lists),
        public_lists=public_lists,
    )