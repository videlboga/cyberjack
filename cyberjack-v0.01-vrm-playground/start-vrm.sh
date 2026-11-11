#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
./node_modules/.bin/tsx src/api/server.ts &
api_pid=$!
trap 'kill "$api_pid" 2>/dev/null || true' EXIT INT TERM
npm run dev
