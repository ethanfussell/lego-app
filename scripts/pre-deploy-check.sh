#!/usr/bin/env bash
# ────────────────────────────────────────────────────────────
# Pre-deploy checklist — run before pushing to production
# Usage:  ./scripts/pre-deploy-check.sh
# ────────────────────────────────────────────────────────────
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No colour

pass=0
warn=0
fail=0

ok()   { echo -e "  ${GREEN}✓${NC} $1"; ((pass++)); }
skip() { echo -e "  ${YELLOW}⚠${NC} $1"; ((warn++)); }
bad()  { echo -e "  ${RED}✗${NC} $1"; ((fail++)); }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ─── Frontend checks ──────────────────────────────────────
echo ""
echo "Frontend (frontend_next)"
echo "────────────────────────"

cd "$ROOT/frontend_next"

# Build
echo "  Running next build…"
if npm run build --silent 2>&1 | tail -1; then
  ok "next build succeeded"
else
  bad "next build failed — fix build errors before deploying"
fi

# Typecheck
if npm run typecheck --silent 2>/dev/null; then
  ok "TypeScript typecheck passed"
else
  bad "TypeScript errors found"
fi

# Required env vars (checked at runtime, but warn if not set on Render)
for var in NEXT_PUBLIC_API_BASE_URL NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY; do
  if [ -n "${!var:-}" ]; then
    ok "$var is set"
  else
    skip "$var not set locally — make sure it's set on Render"
  fi
done

# ─── Backend checks ───────────────────────────────────────
echo ""
echo "Backend"
echo "────────────────────────"

cd "$ROOT/backend"

# Python syntax check
if python -m py_compile app/main.py 2>/dev/null; then
  ok "Backend Python syntax OK"
else
  bad "Backend Python syntax errors"
fi

# Required production env vars
BACKEND_REQUIRED_VARS=(
  DATABASE_URL
  CLERK_JWKS_URL
  SECRET_KEY
  RESEND_API_KEY
)

for var in "${BACKEND_REQUIRED_VARS[@]}"; do
  if [ -n "${!var:-}" ]; then
    ok "$var is set"
  else
    skip "$var not set locally — make sure it's set on Render"
  fi
done

# Dangerous dev settings
if [ "${ALLOW_FAKE_AUTH:-}" = "1" ] || [ "${ALLOW_FAKE_AUTH:-}" = "true" ]; then
  skip "ALLOW_FAKE_AUTH is on (OK for dev, auto-disabled on Render)"
else
  ok "ALLOW_FAKE_AUTH is off"
fi

if [ "${SECRET_KEY:-}" = "change-me-in-production" ]; then
  skip "SECRET_KEY is the default — use a strong random value on Render"
fi

# ─── Git checks ───────────────────────────────────────────
echo ""
echo "Git"
echo "────────────────────────"

cd "$ROOT"

if git diff --quiet 2>/dev/null; then
  ok "Working tree is clean"
else
  skip "Uncommitted changes — consider committing before deploying"
fi

# ─── Summary ──────────────────────────────────────────────
echo ""
echo "────────────────────────"
echo -e "  ${GREEN}${pass} passed${NC}  ${YELLOW}${warn} warnings${NC}  ${RED}${fail} failed${NC}"
echo ""

if [ "$fail" -gt 0 ]; then
  echo -e "${RED}Fix failures before deploying.${NC}"
  exit 1
elif [ "$warn" -gt 0 ]; then
  echo -e "${YELLOW}Warnings present — verify Render env vars are configured.${NC}"
  exit 0
else
  echo -e "${GREEN}All checks passed — ready to deploy.${NC}"
  exit 0
fi
