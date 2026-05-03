#!/bin/bash
# Load .env if present and export variables for child processes
if [ -f ".env" ]; then
  echo "Loading .env"
  set -a
  source ".env"
  set +a
fi

echo "Остановка старых процессов (если есть)"
for port in 3000 5173; do
  pids=$(lsof -ti tcp:${port} 2>/dev/null || true)
  if [ -n "${pids}" ]; then
    echo "Убиваю процессы на порту ${port}: ${pids}"
    kill -9 ${pids} 2>/dev/null || true
  fi
done

pkill -f vite 2>/dev/null || true
pkill -f "src/api/server.ts" 2>/dev/null || true

echo "Запуск сидирования БД..."
npx tsx src/infrastructure/seed.ts || exit 1
npx tsx fix_char.ts 2>/dev/null || true
npx tsx add_player_resources.ts 2>/dev/null || true

echo "Запускаю concurrently (API + UI)"
npx concurrently \
  "npx tsx watch src/api/server.ts" \
  "npm run dev"
