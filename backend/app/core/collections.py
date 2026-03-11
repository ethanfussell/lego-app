# backend/app/core/collections.py
"""Shared helpers for collection operations (owned/wishlist)."""
from __future__ import annotations

import logging

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.set_nums import base_set_num
from app.models import List as ListModel
from app.models import ListItem as ListItemModel

logger = logging.getLogger(__name__)


def move_wishlist_to_owned(db: Session, user_id: int, set_num: str) -> bool:
    """If the set is on the user's wishlist, move it to owned. Returns True if moved."""
    # Find both system lists in a single query
    system_lists = db.execute(
        select(ListModel).where(
            ListModel.owner_id == user_id,
            ListModel.is_system.is_(True),
            ListModel.system_key.in_(["wishlist", "owned"]),
        )
    ).scalars().all()

    wishlist = None
    owned_list = None
    for lst in system_lists:
        if lst.system_key == "wishlist":
            wishlist = lst
        elif lst.system_key == "owned":
            owned_list = lst

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

    # Create owned list if needed
    if not owned_list:
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
