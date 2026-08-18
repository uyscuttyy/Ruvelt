#!/usr/bin/env bash
set -euo pipefail

port="${RUVELT_SMOKE_PORT:-4173}"
log_file="$(mktemp)"
index_file="$(mktemp)"
cleanup() {
  if [[ -n "${preview_pid:-}" ]]; then kill "$preview_pid" 2>/dev/null || true; fi
  rm -f "$log_file" "$index_file"
}
trap cleanup EXIT

npm run preview --workspace @ruvelt/web -- --host 127.0.0.1 --port "$port" >"$log_file" 2>&1 &
preview_pid=$!

for _ in {1..30}; do
  if curl --silent --fail "http://127.0.0.1:$port/" >"$index_file"; then break; fi
  sleep 1
done

curl --silent --fail "http://127.0.0.1:$port/" >"$index_file"
grep -q '<title>Ruvelt</title>' "$index_file"
asset="$(sed -n 's/.*src="\([^"]*\.js\)".*/\1/p' "$index_file")"
[[ -n "$asset" ]]
curl --silent --fail "http://127.0.0.1:$port$asset" >/dev/null

echo "Phase 16 web smoke passed: production preview served index and JavaScript asset."
