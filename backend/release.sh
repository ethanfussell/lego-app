#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

echo "Running migrations (release)..."
alembic upgrade head
echo "Migrations done."
