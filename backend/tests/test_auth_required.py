# tests/test_auth_required.py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_add_owned_requires_auth():
    """
    POST /collections/owned without a Bearer token
    should return 401 Unauthorized.
    """
    payload = {"set_num": "10305", "username": "someone"}  # username is ignored now

    resp = client.post("/collections/owned", json=payload)

    assert resp.status_code == 401
    # FastAPI's OAuth2 usually sets this header for Bearer auth
    assert "WWW-Authenticate" in resp.headers
    assert "bearer" in resp.headers["WWW-Authenticate"].lower()


def test_add_wishlist_requires_auth():
    """
    POST /collections/wishlist without a Bearer token
    should return 401 Unauthorized.
    """
    payload = {"set_num": "10305", "username": "someone"}

    resp = client.post("/collections/wishlist", json=payload)

    assert resp.status_code == 401
    assert "WWW-Authenticate" in resp.headers
    assert "bearer" in resp.headers["WWW-Authenticate"].lower()