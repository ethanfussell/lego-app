# Chat Context (paste into a new ChatGPT thread)

## Repo + stack
- Repo root: ~/lego-app
- Backend: ~/lego-app/backend (FastAPI + SQLAlchemy + Postgres)
- API: http://localhost:8000
- Python: use python3 (venv lives at backend/.venv)

## Auth (dev)
- Authorization header: Bearer fake-token-for-ethan

## What we fixed recently
- DB perms issue was causing 500 (permission denied for table lists). Fixed by granting privileges to the DB user used by the app.
- .env files are ignored by git; backend/.env.example is tracked; real keys are not committed.
- Tests: pytest works; httpx needed for FastAPI TestClient.

## Current contracts (see docs/api-contract-notes.md)
- Set number normalization: accepts base or full; resolves to canonical set_num in DB.
- System collections (owned/wishlist): idempotent delete returns 204; base delete removes any base-* variants.
- Owned add removes from wishlist (idempotent).
- Reorder endpoints enforce exact-match + unique and bump list updated_at.

## Quick commands
- Health:
  curl -s http://localhost:8000/health
- Run tests:
  cd ~/lego-app/backend && python3 -m pytest -q
