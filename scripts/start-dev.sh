#!/bin/bash

# Скрипт для запуска сервера разработки на порту 3000
# Принудительно завершает все процессы и очищает кэш

echo "🚀 Запуск сервера разработки CyberJack..."

# Принудительно завершаем все процессы Node.js и Next.js
echo "🛑 Принудительно завершаем все процессы Node.js и Next.js..."
pkill -f "next" 2>/dev/null || echo "Процессы Next.js не найдены"
pkill -f "node.*dev" 2>/dev/null || echo "Процессы Node.js dev не найдены"
pkill -f "npm.*dev" 2>/dev/null || echo "Процессы npm dev не найдены"

# Очищаем все порты 3000-3005 (на случай если сервер запустился на другом порту)
echo "🧹 Очищаем порты 3000-3005..."
for port in 3000 3001 3002 3003 3004 3005; do
    lsof -ti:$port | xargs kill -9 2>/dev/null || echo "Порт $port свободен"
done

# Ждем освобождения портов
sleep 3

# Очищаем кэш Next.js
echo "🗑️ Очищаем кэш Next.js..."
rm -rf .next 2>/dev/null || echo "Кэш .next не найден"
rm -rf node_modules/.cache 2>/dev/null || echo "Кэш node_modules не найден"

# Проверяем, что порт 3000 свободен
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo "❌ Порт 3000 все еще занят. Принудительно завершаем..."
    sudo lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "Не удалось завершить процесс на порту 3000"
    sleep 2
fi

echo "✅ Порт 3000 свободен"

# Устанавливаем переменную окружения для принудительного использования порта 3000
export PORT=3000

# Запускаем сервер разработки с принудительным портом
echo "🚀 Запускаем Next.js на порту 3000..."
npx next dev -p 3000
