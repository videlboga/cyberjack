#!/bin/bash
# Load .env if present and export variables for child processes
if [ -f ".env" ]; then
  echo "Loading .env"
  # export all variables from .env into environment
  set -a
  # shellcheck disable=SC1091
  source ".env"
  set +a
fi

echo "Запуск сидирования БД..."
# Run seeding; fail fast if it errors
npx tsx src/infrastructure/seed.ts || exit 1
npx tsx fix_char.ts 2>/dev/null || true
npx tsx add_player_resources.ts 2>/dev/null || true

echo "Запуск API и UI..."
npx concurrently \
  "npx tsx watch src/api/server.ts" \
  "npm run dev"

# Clean up any stale dev processes that may block ports or cause duplicate servers.
# Prefer killing by listening port first (safer), then fall back to name-based kills.
echo "Остановка старых процессов (если есть)"
for port in 3000 5173; do
  pids=$(lsof -ti tcp:${port} 2>/dev/null || true)
  if [ -n "${pids}" ]; then
    echo "Убиваю процессы на порту ${port}: ${pids}"
    kill -9 ${pids} 2>/dev/null || true
  fi
done

# Also kill any leftover vite or server node processes by pattern (best-effort)
pkill -f vite 2>/dev/null || true
pkill -f "src/api/server.ts" 2>/dev/null || true

echo "Запускаю concurrently (API + UI)"
npx concurrently \
  "npx tsx watch src/api/server.ts" \
  "npm run dev"
