# tests/test_lists_auth.py
from datetime import datetime

from fastapi.testclient import TestClient

from app.main import app
from app.data.lists import LISTS

client = TestClient(app)


def login(username: str = "ethan", password: str = "lego123"):
    """
    Helper to log in via /auth/login and return the raw response.
    """
    return client.post(
        "/auth/login",
        data={"username": username, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )


def auth_header_for(username: str = "ethan", password: str = "lego123"):
    """
    Helper to log in and build an Authorization header for later requests.
    """
    resp = login(username, password)
    assert resp.status_code == 200, f"Login failed: {resp.status_code} {resp.text}"
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_create_list_requires_auth():
    """
    POST /lists with NO Authorization header should return 401.
    """
    LISTS.clear()

    payload = {
        "owner": "someone-else",   # will be ignored in real auth flow
        "title": "Unauthed List",
        "description": "Should not be created",
        "is_public": True,
    }

    resp = client.post("/lists", json=payload)
    assert resp.status_code == 401  # Not authenticated


def test_create_list_uses_current_user_as_owner():
    """
    POST /lists with a token should succeed and use the logged-in user
    as the owner, ignoring payload.owner.
    """
    LISTS.clear()

    headers = auth_header_for("ethan", "lego123")
    payload = {
        "owner": "someone-else",   # should be ignored
        "title": "My Auth List",
        "description": "Created via tests",
        "is_public": True,
    }

    resp = client.post("/lists", headers=headers, json=payload)
    assert resp.status_code == 201

    data = resp.json()
    assert data["owner"] == "ethan"       # comes from token, not payload.owner
    assert data["title"] == "My Auth List"
    assert data["is_public"] is True


def test_update_list_for_wrong_owner_forbidden():
    """
    If a list is owned by someone_else and ethan tries to PATCH it,
    we should get 403 (forbidden).
    """
    LISTS.clear()

    # Manually insert a list with a different owner.
    now = datetime.utcnow()
    LISTS.append({
        "id": 1,
        "owner": "someone_else",
        "title": "Foreign List",
        "description": None,
        "is_public": True,
        "items": [],
        "created_at": now,
        "updated_at": now,
    })

    headers = auth_header_for("ethan", "lego123")

    resp = client.patch(
        "/lists/1",
        headers=headers,
        json={"title": "Should Not Work"},
    )

    assert resp.status_code == 403  # Only owner can modify


def test_add_item_requires_auth():
    """
    POST /lists/{id}/items without a token should return 401.
    """
    LISTS.clear()

    # Create a list owned by ethan
    now = datetime.utcnow()
    LISTS.append({
        "id": 1,
        "owner": "ethan",
        "title": "Auth List",
        "description": None,
        "is_public": True,
        "items": [],
        "created_at": now,
        "updated_at": now,
    })

    # No Authorization header here
    resp = client.post(
        "/lists/1/items",
        json={"set_num": "10305-1"},  # value doesn't matter; auth fails first
    )

    assert resp.status_code == 401