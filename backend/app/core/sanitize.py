"""Lightweight text sanitization utilities."""
import html
import re

from better_profanity import profanity as _profanity

# Initialise the profanity filter once at module load
_profanity.load_censor_words()


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


def contains_profanity(text: str) -> bool:
    """Return True if the text contains profane language."""
    if not text or not text.strip():
        return False
    return _profanity.contains_profanity(text)
