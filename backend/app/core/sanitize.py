"""Lightweight text sanitization utilities.

Uses only stdlib (html, re) — no external dependencies.
"""
import html
import re


def sanitize_text(value: str) -> str:
    """
    Strip HTML tags and escape remaining special characters.
    Preserves newlines — suitable for multi-line fields (reviews, descriptions).
    """
    if not value:
        return value
    # Remove HTML tags
    stripped = re.sub(r"<[^>]+>", "", value)
    # Escape remaining HTML entities
    return html.escape(stripped, quote=False).strip()


def sanitize_oneline(value: str) -> str:
    """
    For single-line fields (titles, usernames): strip tags, escape, collapse whitespace.
    """
    if not value:
        return value
    stripped = re.sub(r"<[^>]+>", "", value)
    escaped = html.escape(stripped, quote=False)
    # Collapse all whitespace (including newlines) to single space
    return re.sub(r"\s+", " ", escaped).strip()
