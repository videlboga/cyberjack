#!/bin/bash

# Скрипт для чистого перезапуска CyberJack v2.0 на порту 3000
# Очищает все кеши, останавливает процессы и запускает заново

echo "🚀 Чистый перезапуск CyberJack v2.0..."

# Переходим в директорию проекта
cd "$(dirname "$0")/.."

echo "📁 Текущая директория: $(pwd)"

# Останавливаем все процессы Next.js и Node.js
echo "🛑 Останавливаем все процессы Next.js и Node.js..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true
pkill -f "npm run dev" 2>/dev/null || true
pkill -f "node.*next" 2>/dev/null || true

# Ждем завершения процессов
sleep 3

# Освобождаем порт 3000
echo "🔓 Освобождаем порт 3000..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Очищаем все кеши
echo "🧹 Очищаем все кеши..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .turbo
rm -rf .swc
rm -rf .vercel
rm -rf out
rm -rf dist

# Очищаем кеш npm
echo "🧹 Очищаем кеш npm..."
npm cache clean --force

# Проверяем TypeScript (но не останавливаемся на ошибках)
echo "🔍 Проверяем TypeScript..."
npx tsc --noEmit --project . || echo "⚠️ Есть ошибки TypeScript, но продолжаем..."

# Генерируем Prisma клиент
echo "🗄️ Генерируем Prisma клиент..."
npx prisma generate

# Синхронизируем базу данных
echo "🔄 Синхронизируем базу данных..."
npx prisma db push

# Запускаем сервер на порту 3000
echo "🚀 Запускаем сервер на порту 3000..."
echo "🌐 Сервер будет доступен по адресу: http://localhost:3000"
echo "📊 API endpoints:"
echo "   - /api/characters"
echo "   - /api/characteristics"
echo "   - /api/actions"
echo "   - /api/poses"
echo "   - /api/anatomy"
echo "   - /api/chat/[characterId]"
echo "   - /api/time/advance"
echo ""
echo "🛑 Для остановки сервера нажмите Ctrl+C"
echo ""

# Запускаем с принудительным портом 3000
PORT=3000 npm run dev
