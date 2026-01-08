# Chat Context (paste into a new ChatGPT thread)

## Project
- Repo: lego-app (backend + frontend)
- Backend: FastAPI + Postgres + SQLAlchemy
- API base: http://localhost:8000

## Auth (dev)
- Use: Authorization: Bearer fake-token-for-ethan

## Key behaviors we fixed / rely on
- resolve_set_num accepts base ("21354") or full ("21354-1") and returns canonical set_num in DB.
- DELETE wishlist/owned is idempotent and returns 204.
- DELETE by base removes any variant ("10305" removes "10305-1" etc).
- POST /collections/owned also removes from wishlist (idempotent).
- Reorder endpoints enforce:
  - unique set_nums
  - payload must match ALL current items
  - updates parent list updated_at

## Known gotchas we already solved
- DB permissions: ensure the DB user used by the app can read/write lists tables.
- .env files are ignored; backend/.env.example is tracked.
- Tests require httpx.
- Test runner: backend/scripts/test.sh (runs pytest)

## Useful commands
- Run tests:
  - cd backend && ./scripts/test.sh
- Check API health:
  - curl -s http://localhost:8000/health
- Add wishlist:
  - curl -s -X POST "$API/collections/wishlist" -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"set_num":"21354"}'
