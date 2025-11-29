# tests/test_auth_flow.py

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)

# 🔑 Make sure these match whatever you configured in app/core/auth.py
# If you used different credentials there, change these two values.
VALID_USERNAME = "ethan"
VALID_PASSWORD = "lego123"


def login(username: str = VALID_USERNAME, password: str = VALID_PASSWORD):
    """
    Helper: perform a login request and return the response.
    Uses form-encoded data, which is what OAuth2PasswordRequestForm expects.
    """
    return client.post(
        "/auth/login",
        data={
            "username": username,
            "password": password,
        },
    )


def test_login_success_returns_token():
    resp = login()
    assert resp.status_code == 200

    data = resp.json()
    # Basic structure of the token response
    assert "access_token" in data
    assert "token_type" in data
    assert data["token_type"] == "bearer"

    token = data["access_token"]
    assert isinstance(token, str)
    assert token != ""
    # Optional: if your create_access_token uses a prefix like "fake-token-for-"
    assert "fake" in token or "token" in token


def test_login_with_bad_password_fails():
    resp = login(password="wrong-password")
    # In our fake auth we raise HTTPException(status_code=400)
    assert resp.status_code == 400

    data = resp.json()
    # Optional, depending on what you used in auth.py
    # e.g. "Incorrect username or password"
    assert "detail" in data


def test_me_requires_auth():
    """
    Calling /auth/me with NO token should give 401.
    """
    resp = client.get("/auth/me")
    assert resp.status_code == 401

    data = resp.json()
    assert "detail" in data


def test_me_with_valid_token_returns_user():
    """
    Full flow:
    1. Login → get token
    2. Call /auth/me with Authorization: Bearer <token>
    3. Expect current user back
    """
    # 1) login
    login_resp = login()
    assert login_resp.status_code == 200
    token = login_resp.json()["access_token"]

    # 2) call /auth/me
    me_resp = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200

    user = me_resp.json()
    # shape should match your User model
    assert user["username"] == VALID_USERNAME