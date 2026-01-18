from datetime import datetime
from sqlalchemy.orm import Session

# ✅ CHANGE THESE imports to your actual model locations/names
from backend.app.models import User, List  # <-- adjust


def make_user(db: Session, username: str, email: str = None):
    u = User(
        username=username,
        email=email or f"{username}@example.com",
        # if you store hashed passwords, you can set it here too
        # password_hash="...",
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def make_list(
    db: Session,
    owner,
    title: str,
    is_public: bool,
    is_system: bool = False,
    items=None,
):
    # ✅ adjust fields to match your List model
    l = List(
        title=title,
        owner=owner.username if hasattr(owner, "username") else str(owner),
        is_public=is_public,
        is_system=is_system,  # <-- if your field is named differently, change here
        items=items or [],
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(l)
    db.commit()
    db.refresh(l)
    return l