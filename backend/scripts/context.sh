#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "===== CHAT_CONTEXT.md ====="
sed -n '1,220p' docs/CHAT_CONTEXT.md

echo
echo "===== API CONTRACT NOTES ====="
sed -n '1,260p' docs/api-contract-notes.md
