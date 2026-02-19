#!/usr/bin/env bash
set -euo pipefail

BASE="${BASE:-http://localhost:3000}"
SET="${SET:-21354-1}"
THEME="${THEME:-Animal-Crossing}"

echo "== Smoke test =="
echo "BASE=$BASE"
echo "SET=$SET"
echo "THEME=$THEME"
echo

echo "-- robots.txt"
curl -sS "$BASE/robots.txt" | rg -n "User-agent:|Allow:|Disallow:|Sitemap:" || true
echo

echo "-- sitemap.xml (headers + sample locs)"
curl -sS -D - "$BASE/sitemap.xml" -o /dev/null | rg -i "HTTP/|content-type|x-sitemap-"
curl -sS "$BASE/sitemap.xml" | rg -n "<loc>" | head -n 15 || true
echo

echo "-- set page (canonical + og:url)"
curl -sS "$BASE/sets/$SET" | rg -n 'rel="canonical"|property="og:url"|property="og:image"|name="twitter:card"' || true
echo

echo "-- theme page (canonical + og:url)"
curl -sS "$BASE/themes/$THEME" | rg -n 'rel="canonical"|property="og:url"|name="twitter:card"' || true
echo

echo "OK ✅"
