#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# activate venv if it exists
if [ -f .venv/bin/activate ]; then
  source .venv/bin/activate
fi

python -m pytest -q
