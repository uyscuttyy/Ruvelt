#!/usr/bin/env bash
set -euo pipefail

npm run check
npm run build
npm run web:smoke
npm run smoke:testnet
git diff --check

echo "Phase 19 final audit passed. No transaction was submitted."
