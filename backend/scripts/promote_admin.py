"""
Promote a user to admin.

Usage:
    cd backend
    python3 -m scripts.promote_admin --username ethan
    python3 -m scripts.promote_admin --clerk-id user_2abc123
"""
import argparse

from sqlalchemy import select

from app.db import SessionLocal
from app.models import User


def main() -> None:
    parser = argparse.ArgumentParser(description="Promote a user to admin")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--username", help="Username to promote")
    group.add_argument("--clerk-id", help="Clerk ID to promote")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.username:
            user = db.execute(
                select(User).where(User.username == args.username)
            ).scalar_one_or_none()
        else:
            user = db.execute(
                select(User).where(User.clerk_id == args.clerk_id)
            ).scalar_one_or_none()

        if not user:
            raise SystemExit("User not found")

        if user.is_admin:
            print(f"already admin - {user.username} (id={user.id})")
            return

        user.is_admin = True
        db.commit()
        print(f"ok - {user.username} (id={user.id}) is now admin")
    finally:
        db.close()


if __name__ == "__main__":
    main()
