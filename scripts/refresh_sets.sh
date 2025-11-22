#!/usr/bin/env bash
set -euo pipefail

# cd to project root
cd "$HOME/lego-app/backend"

# load .env so REBRICKABLE_API_KEY is available
if [ -f ".env" ]; then
  set -a
  source .env
  set +a
fi

# run the fetcher
/usr/bin/env python3 -m app.data.sets
