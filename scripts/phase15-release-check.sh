#!/usr/bin/env bash
set -euo pipefail

: "${BOT_RPC_URL_TESTNET:?BOT_RPC_URL_TESTNET is required}"
: "${BOT_CHAIN_ID:?BOT_CHAIN_ID is required}"
: "${VITE_RUVELT_CONTRACT_ADDRESS:?VITE_RUVELT_CONTRACT_ADDRESS is required}"

echo "Running local validation..."
npm run check
npm run build

echo "Running BOT Chain smoke validation..."
npm run smoke:testnet

echo "Phase 15 release gate passed. No transaction was submitted."
