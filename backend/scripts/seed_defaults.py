# backend/scripts/seed_defaults.py
import argparse

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db import SessionLocal
from app.models import User, List


def ensure_system_list(db: Session, user_id: int, key: str, title: str) -> List:
    existing = db.execute(
        select(List).where(
            List.owner_id == user_id,
            List.is_system.is_(True),
            List.system_key == key,
        )
    ).scalar_one_or_none()
    if existing:
        return existing

    max_pos = db.execute(
        select(func.coalesce(func.max(List.position), -1))
        .where(List.owner_id == user_id)
    ).scalar_one()

    lst = List(
        owner_id=user_id,
        title=title,
        description=None,
        is_public=False,
        position=int(max_pos) + 1,
        is_system=True,
        system_key=key,
    )
    db.add(lst)
    db.commit()
    db.refresh(lst)
    return lst


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--username", required=True)
    args = p.parse_args()

    db = SessionLocal()
    try:
        user = db.execute(select(User).where(User.username == args.username)).scalar_one_or_none()
        if not user:
            raise SystemExit(f"User '{args.username}' not found in DB")

        ensure_system_list(db, int(user.id), "owned", "Owned")
        ensure_system_list(db, int(user.id), "wishlist", "Wishlist")
        print("ok")
    finally:
        db.close()


if __name__ == "__main__":
    main()