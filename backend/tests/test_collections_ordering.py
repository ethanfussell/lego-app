import os
import random
import string

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.db import get_db
from app.models import Base, User as UserModel, Set as SetModel, List as ListModel, ListItem as ListItemModel


def _rand_username(prefix="u"):
    return prefix + "_" + "".join(random.choice(string.ascii_lowercase) for _ in range(8))


def _token_for(username: str) -> str:
    return f"fake-token-for-{username}"


@pytest.fixture()
def db_session():
    # Use a separate DB for tests if you want:
    # export TEST_DATABASE_URL="postgresql://.../lego_app_test"
    url = os.getenv("TEST_DATABASE_URL") or os.getenv("DATABASE_URL")
    assert url, "Set TEST_DATABASE_URL (recommended) or DATABASE_URL"

    # If DATABASE_URL is a SQLAlchemy URL (postgresql+psycopg2://), normalize for engine
    url = url.replace("postgresql+psycopg2://", "postgresql://")

    engine = create_engine(url)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # For clean runs, create tables (fast). If you rely on Alembic migrations, swap this out.
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Uncomment if you want tests to DROP tables each run (only safe on a test DB!)
        # Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def client(db_session):
    def _override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


def seed_user_and_sets(db, username: str):
    # user
    u = db.execute(select(UserModel).where(UserModel.username == username)).scalar_one_or_none()
    if not u:
        u = UserModel(username=username, password_hash="x")
        db.add(u)
        db.commit()
        db.refresh(u)

    # sets needed by tests
    needed = [
        ("10305-1", "Lion Knights' Castle", 2022, "Icons", 4515, "x"),
        ("21318-1", "Tree House", 2019, "LEGO Ideas and CUUSOO", 3037, "x"),
        ("10026-1", "Naboo Starfighter", 2002, "Star Wars", 188, "x"),
        ("30706-1", "Quidditch Lesson", 2025, "Harry Potter", 27, "x"),
        ("6562115-1", "3D Easter Egg", 2025, "LEGO Brand Store", 41, "x"),
    ]
    for set_num, name, year, theme, pieces, image_url in needed:
        s = db.execute(select(SetModel).where(SetModel.set_num == set_num)).scalar_one_or_none()
        if not s:
            db.add(SetModel(set_num=set_num, name=name, year=year, theme=theme, pieces=pieces, image_url=image_url))
    db.commit()
    return u


def get_system_list_id(db, owner_id: int, key: str) -> int:
    lst = db.execute(
        select(ListModel).where(
            ListModel.owner_id == owner_id,
            ListModel.is_system.is_(True),
            ListModel.system_key == key,
        )
    ).scalar_one()
    return int(lst.id)


def list_positions(db, list_id: int):
    rows = db.execute(
        select(ListItemModel.set_num, ListItemModel.position)
        .where(ListItemModel.list_id == list_id)
        .order_by(ListItemModel.position.asc())
    ).all()
    return [(r[0], int(r[1])) for r in rows]


def assert_contiguous_positions(db, list_id: int):
    rows = list_positions(db, list_id)
    positions = [pos for _, pos in rows]
    assert positions == list(range(len(positions)))


def test_wishlist_reorder_sets_positions(client, db_session):
    username = _rand_username("bob")
    u = seed_user_and_sets(db_session, username)
    token = _token_for(username)
    headers = {"Authorization": f"Bearer {token}"}

    # Add 3 items
    for s in ["10305", "21318", "10026"]:
        r = client.post("/collections/wishlist", headers=headers, json={"set_num": s})
        assert r.status_code == 200

    # Reorder
    r = client.put("/collections/wishlist/order", headers=headers, json={"set_nums": ["10026", "21318", "10305"]})
    assert r.status_code == 200

    wishlist_id = get_system_list_id(db_session, int(u.id), "wishlist")
    assert list_positions(db_session, wishlist_id) == [
        ("10026-1", 0),
        ("21318-1", 1),
        ("10305-1", 2),
    ]


def test_wishlist_delete_repacks_positions(client, db_session):
    username = _rand_username("bob")
    u = seed_user_and_sets(db_session, username)
    token = _token_for(username)
    headers = {"Authorization": f"Bearer {token}"}

    for s in ["6562115", "30706", "10026"]:
        assert client.post("/collections/wishlist", headers=headers, json={"set_num": s}).status_code == 200

    # Ensure order first
    assert client.put(
        "/collections/wishlist/order",
        headers=headers,
        json={"set_nums": ["6562115", "30706", "10026"]},
    ).status_code == 200

    # Delete middle
    r = client.delete("/collections/wishlist/30706", headers=headers)
    assert r.status_code in (200, 204)

    wishlist_id = get_system_list_id(db_session, int(u.id), "wishlist")
    assert_contiguous_positions(db_session, wishlist_id)
    assert [set_num for set_num, _ in list_positions(db_session, wishlist_id)] == ["6562115-1", "10026-1"]


def test_add_owned_removes_from_wishlist_and_appends(client, db_session):
    username = _rand_username("bob")
    u = seed_user_and_sets(db_session, username)
    token = _token_for(username)
    headers = {"Authorization": f"Bearer {token}"}

    # Wishlist: 2 items, put 10305 first
    for s in ["10305", "10026"]:
        assert client.post("/collections/wishlist", headers=headers, json={"set_num": s}).status_code == 200
    assert client.put("/collections/wishlist/order", headers=headers, json={"set_nums": ["10305", "10026"]}).status_code == 200

    # Owned: add one item first so we can verify "append"
    assert client.post("/collections/owned", headers=headers, json={"set_num": "6562115"}).status_code == 200

    # Now add_owned(10305) should:
    # - add to owned
    # - remove from wishlist
    assert client.post("/collections/owned", headers=headers, json={"set_num": "10305"}).status_code == 200

    owned_id = get_system_list_id(db_session, int(u.id), "owned")
    wishlist_id = get_system_list_id(db_session, int(u.id), "wishlist")

    # 10305 should be gone from wishlist (and positions repacked)
    assert [sn for sn, _ in list_positions(db_session, wishlist_id)] == ["10026-1"]
    assert_contiguous_positions(db_session, wishlist_id)

    # 10305 should be appended after 6562115 in owned
    assert [sn for sn, _ in list_positions(db_session, owned_id)] == ["6562115-1", "10305-1"]
    assert_contiguous_positions(db_session, owned_id)