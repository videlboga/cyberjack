#!/bin/bash

# Скрипт для полной сборки CyberJack v2.0

echo "🔨 Полная сборка CyberJack v2.0..."

# Переходим в директорию проекта
cd "$(dirname "$0")/.."

echo "📁 Текущая директория: $(pwd)"

# Останавливаем все процессы
echo "🛑 Останавливаем все процессы..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "next start" 2>/dev/null || true

# Очищаем все кеши и временные файлы
echo "🧹 Очищаем кеши и временные файлы..."
rm -rf .next
rm -rf node_modules/.cache
rm -rf .turbo
rm -rf dist
rm -rf build

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
    echo "❌ Ошибки TypeScript найдены. Исправьте их перед сборкой."
    exit 1
fi

echo "✅ TypeScript проверка пройдена"

# Собираем проект
echo "🔨 Собираем проект..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ Ошибка сборки проекта"
    exit 1
fi

echo "✅ Сборка завершена успешно!"
echo ""
echo "📁 Собранные файлы находятся в директории .next/"
echo "🚀 Для запуска продакшн сервера используйте: npm start"
echo "🧪 Для тестирования API используйте: ./scripts/test-api.sh"

