# backend/tests/test_lists_visibility.py
from sqlalchemy.orm import Session

from backend.app.models import User, List  # adjust if your models module differs


def create_user(db: Session, username: str) -> User:
    u = User(username=username, password_hash=None)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def create_list(
    db: Session,
    owner: User,          # ✅ take a User, not a username string
    title: str,
    is_public: bool,
    is_system: bool = False,
) -> List:
    kwargs = dict(
        title=title,
        owner_id=owner.id,   # ✅ use FK, avoids relationship confusion
        is_public=is_public,
    )

    # try to set is_system only if the field exists
    if hasattr(List, "is_system"):
        kwargs["is_system"] = is_system
    elif hasattr(List, "is_system_list"):
        kwargs["is_system_list"] = is_system
    elif hasattr(List, "system"):
        kwargs["system"] = is_system

    l = List(**kwargs)
    db.add(l)
    db.commit()
    db.refresh(l)
    return l


def auth_header(username: str) -> dict:
    return {"Authorization": f"Bearer fake-token-for-{username}"}


def test_public_lists_only_returns_public(client, db_session):
    alice = create_user(db_session, "alice")
    bob = create_user(db_session, "bob")

    create_list(db_session, alice, "Alice Public", True)
    create_list(db_session, alice, "Alice Private", False)
    create_list(db_session, bob, "Bob Public", True)

    resp = client.get("/lists/public")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)

    titles = {x.get("title") or x.get("name") for x in data}
    assert "Alice Public" in titles
    assert "Bob Public" in titles
    assert "Alice Private" not in titles


def test_private_list_not_visible_logged_out(client, db_session):
    alice = create_user(db_session, "alice2")
    private_list = create_list(db_session, alice, "Top Secret", False)

    resp = client.get(f"/lists/{private_list.id}")
    assert resp.status_code == 404


def test_private_list_visible_to_owner_logged_in(client, db_session):
    alice = create_user(db_session, "alice3")
    private_list = create_list(db_session, alice, "Owner Can See", False)

    resp = client.get(f"/lists/{private_list.id}", headers=auth_header(alice.username))
    assert resp.status_code == 200
    data = resp.json()
    assert (data.get("title") or data.get("name")) == "Owner Can See"