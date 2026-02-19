#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
SET="${SET:-21354-1}"
THEME="${THEME:-Animal-Crossing}"

echo "BASE=$BASE"
echo "SET=$SET"
echo "THEME=$THEME"
echo

echo "== Set head tags =="
curl -sS "$BASE/sets/$SET" \
  | rg -n '(<link[^>]+rel="canonical"[^>]*>|<meta[^>]+property="og:url"[^>]*>|<meta[^>]+property="og:image"[^>]*>|<meta[^>]+name="twitter:card"[^>]*>)' \
  | head -n 50 || true

echo
echo "== Theme head tags =="
curl -sS "$BASE/themes/$THEME" \
  | rg -n '(<link[^>]+rel="canonical"[^>]*>|<meta[^>]+property="og:url"[^>]*>|<meta[^>]+name="twitter:card"[^>]*>)' \
  | head -n 50 || true
