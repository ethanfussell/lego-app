## Dev

### Backend
cd backend
uvicorn app.main:app --reload --port 8000

### Frontend (Next)
cd frontend_next
npm install
npm run dev

Env: frontend_next/.env.local
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:8000
NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000

## Auth sanity checklist (dev)

1) Backend running:
   - `curl -s http://127.0.0.1:8000/health` -> {"ok":true}

2) Frontend running:
   - visit http://127.0.0.1:3000

3) Redirect guard:
   - open http://127.0.0.1:3000/collection while logged out -> should redirect to /login

4) Login:
   - login succeeds, token stored in localStorage
   - refresh page -> still logged in (no redirect loop)

5) Me hydration:
   - after login, `me` loads (ProfileMenu shows user)
   - if token is invalid, refresh -> redirects to /login (token cleared)