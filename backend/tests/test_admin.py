"""Tests for admin endpoint protection."""
import pytest
from app.models import User


def test_admin_stats_requires_auth(client):
    """GET /admin/stats without token returns 401."""
    resp = client.get("/admin/stats")
    assert resp.status_code == 401


def test_admin_refresh_requires_auth(client):
    """POST /admin/sets/refresh without token returns 401."""
    resp = client.post("/admin/sets/refresh")
    assert resp.status_code == 401


def test_admin_sync_requires_auth(client):
    """POST /admin/sets/sync without token returns 401."""
    resp = client.post("/admin/sets/sync")
    assert resp.status_code == 401


def test_admin_stats_requires_admin(client, db_session):
    """GET /admin/stats with non-admin user returns 403."""
    user = User(username="regular", email="regular@example.com", is_admin=False)
    db_session.add(user)
    db_session.commit()

    resp = client.get(
        "/admin/stats",
        headers={"Authorization": "Bearer fake-token-for-regular"},
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Admin access required"


def test_admin_refresh_requires_admin(client, db_session):
    """POST /admin/sets/refresh with non-admin user returns 403."""
    user = User(username="nonadmin", email="nonadmin@example.com", is_admin=False)
    db_session.add(user)
    db_session.commit()

    resp = client.post(
        "/admin/sets/refresh",
        headers={"Authorization": "Bearer fake-token-for-nonadmin"},
    )
    assert resp.status_code == 403


def test_admin_stats_works_for_admin(client, db_session):
    """GET /admin/stats returns counts for admin user."""
    user = User(username="adminuser", email="admin@example.com", is_admin=True)
    db_session.add(user)
    db_session.commit()

    resp = client.get(
        "/admin/stats",
        headers={"Authorization": "Bearer fake-token-for-adminuser"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "set_count" in data
    assert "user_count" in data
    assert "email_signup_count" in data
    assert isinstance(data["set_count"], int)
    assert isinstance(data["user_count"], int)
    assert isinstance(data["email_signup_count"], int)


def test_auth_me_includes_is_admin(client, db_session):
    """GET /auth/me includes is_admin field."""
    user = User(username="checkadmin", email="check@example.com", is_admin=True)
    db_session.add(user)
    db_session.commit()

    resp = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer fake-token-for-checkadmin"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_admin"] is True


def test_auth_me_non_admin(client, db_session):
    """GET /auth/me returns is_admin=false for regular user."""
    user = User(username="normaluser", email="normal@example.com", is_admin=False)
    db_session.add(user)
    db_session.commit()

    resp = client.get(
        "/auth/me",
        headers={"Authorization": "Bearer fake-token-for-normaluser"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_admin"] is False
