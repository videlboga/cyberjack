#!/bin/bash

# Скрипт для запуска CyberJack v2.0 на порту 3000
# Очищает порт, кеш и запускает новый проект

echo "🚀 Запуск CyberJack v2.0..."

# Переходим в директорию проекта
cd "$(dirname "$0")/.."

echo "📁 Текущая директория: $(pwd)"

# Останавливаем все процессы Next.js
echo "🛑 Останавливаем все процессы Next.js..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true

# Ждем завершения процессов
sleep 2

# Освобождаем порт 3000
echo "🔓 Освобождаем порт 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Очищаем кеш Next.js
echo "🧹 Очищаем кеш Next.js..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .turbo

# Очищаем кеш npm
echo "🧹 Очищаем кеш npm..."
npm cache clean --force

# Устанавливаем зависимости
echo "📦 Устанавливаем зависимости..."
npm install

# Генерируем Prisma клиент
echo "🗄️ Генерируем Prisma клиент..."
npx prisma generate

# Проверяем TypeScript
echo "🔍 Проверяем TypeScript..."
npx tsc --noEmit --project .

if [ $? -ne 0 ]; then
    echo "❌ Ошибки TypeScript найдены. Исправьте их перед запуском."
    exit 1
fi

echo "✅ TypeScript проверка пройдена"

# Запускаем сервер на порту 3000
echo "🚀 Запускаем сервер на порту 3000..."
echo "🌐 Сервер будет доступен по адресу: http://localhost:3000"
echo "📊 API endpoints:"
echo "   - /api/characteristics/[characterId]/[characteristicId]"
echo "   - /api/actions/execute"
echo "   - /api/chat/[characterId]"
echo "   - /api/time/advance"
echo ""
echo "🛑 Для остановки сервера нажмите Ctrl+C"
echo ""

npm run dev -- -p 3000

