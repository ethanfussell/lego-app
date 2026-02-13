# tests/test_lists_public.py
from datetime import datetime, timedelta, UTC

from fastapi.testclient import TestClient

from app.main import app
from app.data import lists as lists_data

client = TestClient(app)


def _reset_lists():
    lists_data.LISTS.clear()


def test_public_lists_only_public():
    _reset_lists()
    now = datetime.now(UTC)

    # public list
    lists_data.LISTS.append({
        "id": 1,
        "owner": "ethan",
        "title": "Public List",
        "description": None,
        "is_public": True,
        "items": [],
        "created_at": now,
        "updated_at": now,
    })

    # private list
    lists_data.LISTS.append({
        "id": 2,
        "owner": "ethan",
        "title": "Private List",
        "description": None,
        "is_public": False,
        "items": [],
        "created_at": now,
        "updated_at": now,
    })

    resp = client.get("/lists/public")
    assert resp.status_code == 200

    data = resp.json()
    titles = [l["title"] for l in data]

    assert "Public List" in titles
    assert "Private List" not in titles


def test_public_lists_sorted_by_updated_desc():
    _reset_lists()
    now = datetime.now(UTC)

    lists_data.LISTS.append({
        "id": 1,
        "owner": "ethan",
        "title": "Older",
        "description": None,
        "is_public": True,
        "items": [],
        "created_at": now - timedelta(days=2),
        "updated_at": now - timedelta(days=2),
    })

    lists_data.LISTS.append({
        "id": 2,
        "owner": "ethan",
        "title": "Newer",
        "description": None,
        "is_public": True,
        "items": [],
        "created_at": now - timedelta(days=1),
        "updated_at": now - timedelta(days=1),
    })

    resp = client.get("/lists/public")
    assert resp.status_code == 200

    data = resp.json()
    titles = [l["title"] for l in data]

    # Newer should come before Older
    assert titles[0] == "Newer"
    assert titles[1] == "Older"


def test_public_lists_owner_filter():
    _reset_lists()
    now = datetime.now(UTC)

    lists_data.LISTS.append({
        "id": 1,
        "owner": "ethan",
        "title": "Ethan List",
        "description": None,
        "is_public": True,
        "items": [],
        "created_at": now,
        "updated_at": now,
    })

    lists_data.LISTS.append({
        "id": 2,
        "owner": "alice",
        "title": "Alice List",
        "description": None,
        "is_public": True,
        "items": [],
        "created_at": now,
        "updated_at": now,
    })

    resp = client.get("/lists/public", params={"owner": "ethan"})
    assert resp.status_code == 200

    data = resp.json()
    titles = [l["title"] for l in data]
    owners = [l["owner"] for l in data]

    assert titles == ["Ethan List"]
    assert owners == ["ethan"]