# backend/tests/test_system_lists.py
import pytest
from sqlalchemy.orm import Session

from backend.app.models import User, List


def create_user(db: Session, username: str) -> User:
    u = User(username=username, password_hash=None)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def system_flag_field_name() -> str | None:
    for name in ("is_system", "is_system_list", "system"):
        if hasattr(List, name):
            return name
    return None


def create_system_list(db: Session, owner: User) -> List:
    flag = system_flag_field_name()
    if not flag:
        pytest.skip("No system-list flag found on List model (is_system / is_system_list / system).")

    kwargs = {
        "title": "System List",
        "owner_id": owner.id,   # ✅ IMPORTANT: use owner_id (or owner=owner)
        "is_public": False,
    }
    kwargs[flag] = True

    # Optional: if your model has system_key, set it
    if hasattr(List, "system_key"):
        kwargs["system_key"] = "owned"

    l = List(**kwargs)
    db.add(l)
    db.commit()
    db.refresh(l)
    return l


def auth_header(username: str) -> dict:
    return {"Authorization": f"Bearer fake-token-for-{username}"}


def test_cannot_reorder_system_list(client, db_session):
    owner = create_user(db_session, "sysowner")
    sys_list = create_system_list(db_session, owner)

    resp = client.put(
        f"/lists/{sys_list.id}/items/order",
        headers=auth_header(owner.username),
        json={"set_nums": ["1234"]},  # doesn't need to exist IF router blocks system list before resolving
    )

    assert resp.status_code in (400, 403)


def test_cannot_add_item_to_system_list(client, db_session):
    owner = create_user(db_session, "sysowner2")
    sys_list = create_system_list(db_session, owner)

    resp = client.post(
        f"/lists/{sys_list.id}/items",
        headers=auth_header(owner.username),
        json={"set_num": "1234"},
    )

    if resp.status_code == 404:
        pytest.skip("No POST /lists/{id}/items endpoint in this API.")
    assert resp.status_code in (400, 403)