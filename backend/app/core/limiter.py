"""Shared rate limiter instance.

Disabled automatically during tests (PYTEST_CURRENT_TEST env var).
Uses in-memory storage — no Redis dependency needed.
"""
import os

from slowapi import Limiter
from slowapi.util import get_remote_address

_is_testing = os.getenv("PYTEST_CURRENT_TEST") is not None

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["60/minute"],
    storage_uri="memory://",
    enabled=not _is_testing,
)
