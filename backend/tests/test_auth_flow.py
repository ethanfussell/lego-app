# tests/test_auth_flow.py
"""
Auth flow tests — updated for Clerk-based authentication.

Uses fake-token-for-{username} pattern for test auth (ALLOW_FAKE_AUTH=true).
Login/register endpoints have been removed (handled by Clerk).
"""
import pytest
from sqlalchemy.orm import Session

from app.models import User


def test_me_requires_auth(client):
    """
    Calling /auth/me with NO token should give 401.
    """
    resp = client.get("/auth/me")
    assert resp.status_code == 401

    data = resp.json()
    assert "detail" in data


def test_me_with_valid_fake_token(client, db_session: Session):
    """
    Full flow with fake auth:
    1. Create a user in the DB
    2. Call /auth/me with Authorization: Bearer fake-token-for-{username}
    3. Expect current user back
    """
    # Create test user
    user = User(username="testuser", email="test@example.com")
    db_session.add(user)
    db_session.commit()

    # Call /auth/me with fake token
    resp = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer fake-token-for-testuser"},
    )
    assert resp.status_code == 200

    data = resp.json()
    assert data["username"] == "testuser"


def test_me_with_invalid_token_returns_401(client):
    """
    A non-fake, non-Clerk token should return 401.
    """
    resp = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer invalid-random-token"},
    )
    assert resp.status_code == 401


def test_auto_create_user_on_first_api_call(client, db_session: Session):
    """
    When a fake token references a username that doesn't exist,
    the user should be auto-created on first API call.
    """
    # Verify user doesn't exist
    assert db_session.query(User).filter(User.username == "newuser").first() is None

    resp = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer fake-token-for-newuser"},
    )
    assert resp.status_code == 200
    assert resp.json()["username"] == "newuser"

    # Verify user was created in DB
    user = db_session.query(User).filter(User.username == "newuser").first()
    assert user is not None
    assert user.clerk_id == "newuser"
