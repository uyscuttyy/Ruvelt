#!/usr/bin/env bash
set -euo pipefail

grep -q 'BOT_RPC_URL_TESTNET' .env.example
grep -q 'BOT_CHAIN_ID' .env.example
grep -q 'VITE_RUVELT_CONTRACT_ADDRESS' .env.example
grep -q '0xf13ad20A3e912978Ab683b95AAdD9832d008ae0c' contracts/deployments/bot-chain-testnet.md
grep -q '968' contracts/deployments/bot-chain-testnet.md

echo "Phase 18 configuration audit passed."
