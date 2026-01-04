import argparse

from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db import SessionLocal
import bcrypt
from app.models import User as UserModel, List as ListModel


def get_password_hash(password: str) -> str:
    pw = (password or "").encode("utf-8")
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(pw, salt).decode("utf-8")

def get_or_create_user(db: Session, username: str, password: str) -> UserModel:
    username = (username or "").strip()
    if not username:
        raise SystemExit("username required")

    user = db.execute(
        select(UserModel).where(UserModel.username == username).limit(1)
    ).scalar_one_or_none()

    if user:
        return user

    user = UserModel(username=username, password_hash=get_password_hash(password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def get_or_create_system_list(db: Session, user_id: int, key: str) -> ListModel:
    key = (key or "").strip().lower()
    if key not in ("owned", "wishlist"):
        raise SystemExit("system key must be 'owned' or 'wishlist'")

    existing = db.execute(
        select(ListModel)
        .where(
            ListModel.owner_id == user_id,
            ListModel.is_system.is_(True),
            ListModel.system_key == key,
        )
        .limit(1)
    ).scalar_one_or_none()

    if existing:
        return existing

    title = "Owned" if key == "owned" else "Wishlist"
    max_pos = db.execute(
        select(func.coalesce(func.max(ListModel.position), -1))
        .where(ListModel.owner_id == user_id)
    ).scalar_one()

    lst = ListModel(
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
    parser = argparse.ArgumentParser()
    parser.add_argument("--username", required=True)
    parser.add_argument("--password", default="test123")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        user = get_or_create_user(db, args.username, args.password)
        owned = get_or_create_system_list(db, int(user.id), "owned")
        wishlist = get_or_create_system_list(db, int(user.id), "wishlist")

        print("ok")
        print(f"user: {user.id} {user.username}")
        print(f"owned: {owned.id} (system_key={owned.system_key})")
        print(f"wishlist: {wishlist.id} (system_key={wishlist.system_key})")
    finally:
        db.close()


if __name__ == "__main__":
    main()