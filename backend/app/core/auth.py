# backend/app/core/auth.py
"""
Clerk-based authentication.

Verifies Clerk session JWTs using the JWKS endpoint (RS256).
Auto-creates local User records on first authenticated API call.
Keeps ALLOW_FAKE_AUTH support for tests (fake-token-for-{username}).
"""
from __future__ import annotations

import os
import threading
from typing import Optional

import jwt as pyjwt
from jwt import PyJWKClient, PyJWKClientError
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User

router = APIRouter()

# ---------------------------------------------------------------------------
# Bearer scheme — using OAuth2PasswordBearer for backwards compat (returns 401)
# tokenUrl is irrelevant since login is handled by Clerk, but required by FastAPI
# ---------------------------------------------------------------------------
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=True)
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/auth/login", auto_error=False)


# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
def _settings():
    allow_fake = (os.getenv("ALLOW_FAKE_AUTH") or "").lower() in ("1", "true", "yes", "on")
    debug = (os.getenv("AUTH_DEBUG") or "").lower() in ("1", "true", "yes", "on")

    # In tests, allow fake auth by default
    if os.getenv("PYTEST_CURRENT_TEST") is not None:
        allow_fake = True

    # NEVER allow fake auth in production
    # Render sets RENDER; also check for common production indicators
    is_production = (
        os.getenv("RENDER") is not None
        or (os.getenv("ENVIRONMENT") or "").lower() == "production"
        or (os.getenv("NODE_ENV") or "").lower() == "production"
    )
    if is_production:
        allow_fake = False

    jwks_url = (os.getenv("CLERK_JWKS_URL") or "").strip()

    return allow_fake, debug, jwks_url


# ---------------------------------------------------------------------------
# JWKS client — lazily initialized, cached
# ---------------------------------------------------------------------------
_jwks_client: Optional[PyJWKClient] = None
_jwks_lock = threading.Lock()


def _get_jwks_client() -> Optional[PyJWKClient]:
    global _jwks_client
    if _jwks_client is not None:
        return _jwks_client

    _, _, jwks_url = _settings()
    if not jwks_url:
        return None

    with _jwks_lock:
        if _jwks_client is not None:
            return _jwks_client
        _jwks_client = PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
        return _jwks_client


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _unauth(detail: str = "Invalid token") -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _clerk_id_from_token(token: str) -> Optional[str]:
    """
    Verify a Clerk JWT and return the `sub` claim (Clerk user ID).
    For fake tokens (test mode), returns the username portion.
    Returns None on failure (unless debug mode raises).
    """
    token = (token or "").strip()
    if not token:
        return None

    allow_fake, debug, _ = _settings()

    # Test/dev fake auth
    if allow_fake and token.startswith("fake-token-for-"):
        return token.replace("fake-token-for-", "", 1).strip() or None

    client = _get_jwks_client()
    if client is None:
        if allow_fake:
            # No JWKS URL configured + fake auth allowed: can't verify
            return None
        raise _unauth("Server misconfigured: CLERK_JWKS_URL not set")

    try:
        signing_key = client.get_signing_key_from_jwt(token)
        payload = pyjwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={
                "verify_exp": True,
                "verify_aud": False,  # Clerk tokens may not have aud
            },
        )
        sub = payload.get("sub")
        return str(sub).strip() if sub else None
    except pyjwt.ExpiredSignatureError:
        if debug:
            raise _unauth("Token expired")
        return None
    except (pyjwt.InvalidTokenError, PyJWKClientError) as e:
        if debug:
            raise _unauth(f"JWT verification failed: {e!r}")
        return None
    except Exception as e:
        if debug:
            raise _unauth(f"JWT error: {e!r}")
        return None


def _get_or_create_user(db: Session, clerk_id: str) -> User:
    """
    Look up a user by clerk_id. If not found, auto-create one.
    This handles first-time users seamlessly — they're created in our DB
    on their first authenticated API call after signing up via Clerk.
    """
    user = db.query(User).filter(User.clerk_id == clerk_id).first()
    if user:
        return user

    # For real Clerk, clerk_id is like "user_2abc123..."
    is_clerk_format = clerk_id.startswith("user_")

    user = User(
        clerk_id=clerk_id,
        username=clerk_id if not is_clerk_format else f"user_{clerk_id[-8:]}",
        email=None,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # Send welcome email (non-blocking, best-effort)
    if user.email:
        try:
            from app.core.email import send_welcome_email
            send_welcome_email(user.email, user.username)
        except Exception:
            pass  # never fail user creation over email

    return user


# ---------------------------------------------------------------------------
# FastAPI dependencies — same function signatures as before
# ---------------------------------------------------------------------------
def get_current_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    clerk_id = _clerk_id_from_token(token)
    if not clerk_id:
        raise _unauth("Invalid token")

    allow_fake, _, _ = _settings()

    # Fake auth mode: look up by username (backwards compat with tests)
    if allow_fake and not clerk_id.startswith("user_"):
        user = db.query(User).filter(User.username == clerk_id).first()
        if user:
            return user
        # If not found by username, auto-create with clerk_id
        return _get_or_create_user(db, clerk_id)

    return _get_or_create_user(db, clerk_id)


def get_current_user_optional(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme_optional),
) -> Optional[User]:
    if not token:
        return None
    try:
        clerk_id = _clerk_id_from_token(token)
    except HTTPException:
        return None
    if not clerk_id:
        return None

    allow_fake, _, _ = _settings()

    if allow_fake and not clerk_id.startswith("user_"):
        user = db.query(User).filter(User.username == clerk_id).first()
        if user:
            return user

    try:
        return _get_or_create_user(db, clerk_id)
    except Exception:
        return None


def get_admin_user(
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme),
) -> User:
    """
    FastAPI dependency: returns the authenticated user only if they are an admin.
    Raises 401 if not authenticated, 403 if not admin.
    """
    user = get_current_user(db=db, token=token)
    if not getattr(user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return user


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/auth/me")
def me(request: Request, current_user: User = Depends(get_current_user)):
    return {
        "username": current_user.username,
        "is_admin": bool(getattr(current_user, "is_admin", False)),
    }
