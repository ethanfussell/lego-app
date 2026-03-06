# backend/app/core/cache.py
"""Simple thread-safe in-memory LRU cache with TTL expiry.

Usage:
    from app.core.cache import cached

    @cached(ttl=300)  # 5 minutes
    def expensive_query(db, set_num):
        ...

The decorator caches based on all positional/keyword args (skipping any
SQLAlchemy Session objects, which aren't hashable).
"""
from __future__ import annotations

import functools
import threading
import time
from collections import OrderedDict
from typing import Any, Callable

# Max entries per cache
_MAX_SIZE = 256


class _TTLCache:
    """Thread-safe LRU cache with TTL expiry."""

    def __init__(self, ttl: float, max_size: int = _MAX_SIZE) -> None:
        self.ttl = ttl
        self.max_size = max_size
        self._store: OrderedDict[str, tuple[float, Any]] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> tuple[bool, Any]:
        with self._lock:
            if key not in self._store:
                return False, None

            ts, value = self._store[key]
            if time.monotonic() - ts > self.ttl:
                del self._store[key]
                return False, None

            # Move to end (most-recently used)
            self._store.move_to_end(key)
            return True, value

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            if key in self._store:
                self._store.move_to_end(key)

            self._store[key] = (time.monotonic(), value)

            # Evict oldest if over max_size
            while len(self._store) > self.max_size:
                self._store.popitem(last=False)

    def clear(self) -> None:
        with self._lock:
            self._store.clear()

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._store)


def _make_key(args: tuple, kwargs: dict) -> str:
    """Build a hashable cache key, skipping non-hashable args like DB sessions."""
    parts: list[str] = []

    for a in args:
        try:
            hash(a)
            parts.append(repr(a))
        except TypeError:
            # Skip unhashable args (e.g., SQLAlchemy sessions)
            continue

    for k, v in sorted(kwargs.items()):
        try:
            hash(v)
            parts.append(f"{k}={v!r}")
        except TypeError:
            continue

    return "|".join(parts)


def cached(ttl: float = 300) -> Callable:
    """Decorator that caches function results with a TTL (seconds).

    Args:
        ttl: Time-to-live in seconds. Default 300 (5 minutes).
    """
    cache = _TTLCache(ttl=ttl)

    def decorator(fn: Callable) -> Callable:
        @functools.wraps(fn)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            key = f"{fn.__module__}.{fn.__qualname__}:{_make_key(args, kwargs)}"
            hit, value = cache.get(key)
            if hit:
                return value

            result = fn(*args, **kwargs)
            cache.set(key, result)
            return result

        # Expose cache control for testing/admin
        wrapper.cache = cache  # type: ignore[attr-defined]
        return wrapper

    return decorator
