#!/usr/bin/env bash
set -euo pipefail

: "${BOT_RPC_URL_TESTNET:?Set BOT_RPC_URL_TESTNET before running the smoke check}"
: "${BOT_CHAIN_ID:?Set BOT_CHAIN_ID before running the smoke check}"
: "${VITE_RUVELT_CONTRACT_ADDRESS:?Set VITE_RUVELT_CONTRACT_ADDRESS before running the smoke check}"

actual_chain_id="$(cast chain-id --rpc-url "$BOT_RPC_URL_TESTNET")"
if [[ "$actual_chain_id" != "$BOT_CHAIN_ID" ]]; then
  printf 'Expected chain %s, received %s\n' "$BOT_CHAIN_ID" "$actual_chain_id" >&2
  exit 1
fi

code_hex="$(cast code "$VITE_RUVELT_CONTRACT_ADDRESS" --rpc-url "$BOT_RPC_URL_TESTNET")"
code_bytes=$(((${#code_hex} - 2) / 2))
if (( code_bytes == 0 )); then
  printf 'No contract bytecode found at %s\n' "$VITE_RUVELT_CONTRACT_ADDRESS" >&2
  exit 1
fi

printf 'BOT Chain smoke check passed: chain=%s contract=%s code_bytes=%s\n' "$actual_chain_id" "$VITE_RUVELT_CONTRACT_ADDRESS" "$code_bytes"
