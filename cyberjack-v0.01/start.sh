#!/bin/bash
echo "Запуск сидирования БД..."
npx tsx src/infrastructure/seed.ts || exit 1
npx tsx fix_char.ts 2>/dev/null
npx tsx add_player_resources.ts 2>/dev/null

echo "Запуск API и UI..."
npx concurrently \
  "npx tsx watch src/infrastructure/api_server.ts" \
  "npm run dev"
