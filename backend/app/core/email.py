# backend/app/core/email.py
"""Transactional email via Resend. No-op if RESEND_API_KEY is not set."""
from __future__ import annotations

import logging
import os
from typing import Optional

logger = logging.getLogger(__name__)

_RESEND_API_KEY: Optional[str] = None
_FROM_ADDRESS: str = "BrickTrack <noreply@bricktrack.com>"


def _get_api_key() -> Optional[str]:
    global _RESEND_API_KEY
    if _RESEND_API_KEY is None:
        _RESEND_API_KEY = (os.getenv("RESEND_API_KEY") or "").strip()
    return _RESEND_API_KEY or None


def send_email(to: str, subject: str, html_body: str) -> bool:
    """Send a transactional email. Returns True on success, False on failure.

    If RESEND_API_KEY is not set, logs and returns False (safe in dev).
    """
    api_key = _get_api_key()
    if not api_key:
        logger.info("RESEND_API_KEY not set — skipping email to %s: %s", to, subject)
        return False

    try:
        import resend

        resend.api_key = api_key
        resend.Emails.send(
            {
                "from": _FROM_ADDRESS,
                "to": [to],
                "subject": subject,
                "html": html_body,
            }
        )
        logger.info("Email sent to %s: %s", to, subject)
        return True
    except Exception:
        logger.exception("Failed to send email to %s: %s", to, subject)
        return False


# ---- Templates ----

def send_welcome_email(to: str, username: str) -> bool:
    """Send a welcome email to a newly registered user."""
    subject = "Welcome to BrickTrack!"
    html = f"""
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
      <h1 style="font-size: 24px; font-weight: 700; color: #18181b; margin: 0;">
        Welcome to BrickTrack!
      </h1>
      <p style="margin-top: 12px; font-size: 15px; color: #52525b; line-height: 1.6;">
        Hey {username}, thanks for joining. BrickTrack helps you track your LEGO collection,
        discover new sets, and find the best deals.
      </p>
      <p style="margin-top: 16px; font-size: 15px; color: #52525b; line-height: 1.6;">
        Here are a few things to get started:
      </p>
      <ul style="margin-top: 8px; padding-left: 20px; font-size: 15px; color: #52525b; line-height: 1.8;">
        <li>Search for a set and add it to your collection</li>
        <li>Create a wishlist of sets you want</li>
        <li>Write reviews and rate your favorite builds</li>
        <li>Browse themes and discover new sets</li>
      </ul>
      <div style="margin-top: 24px;">
        <a href="https://bricktrack.com/search"
           style="display: inline-block; background: #f59e0b; color: #000; padding: 10px 24px;
                  border-radius: 999px; font-weight: 600; font-size: 14px; text-decoration: none;">
          Start exploring
        </a>
      </div>
      <p style="margin-top: 32px; font-size: 12px; color: #a1a1aa;">
        BrickTrack &mdash; Track, rate, and discover LEGO sets.
      </p>
    </div>
    """
    return send_email(to, subject, html)
