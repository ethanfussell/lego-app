#!/usr/bin/env bash
set -euo pipefail

SMOKE_DB="${SMOKE_DB:-lego_app_smoke}"
DEV_DB="${DEV_DB:-lego_app}"

echo "Resetting smoke DB: $SMOKE_DB (from schema of $DEV_DB)"

dropdb --if-exists "$SMOKE_DB"
createdb "$SMOKE_DB"

pg_dump --schema-only --no-owner --no-privileges "$DEV_DB" | psql "$SMOKE_DB" >/dev/null

export DATABASE_URL="postgresql+psycopg2://$USER@localhost/$SMOKE_DB"
echo "DATABASE_URL=$DATABASE_URL"

pushd backend >/dev/null
alembic stamp head
popd >/dev/null

psql "$SMOKE_DB" -c "SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;"
echo "✅ Smoke DB ready."
