#!/bin/bash

# Скрипт для тестирования API endpoints CyberJack v2.0

echo "🧪 Тестирование API endpoints CyberJack v2.0..."
echo ""

# Проверяем, что сервер запущен
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ Сервер не запущен на порту 3000"
    echo "💡 Запустите сервер командой: ./scripts/start-dev.sh"
    exit 1
fi

echo "✅ Сервер запущен на порту 3000"
echo ""

# Тестируем API endpoints
echo "🔍 Тестируем API endpoints..."

# Тест 1: Characteristics API
echo "1️⃣ Тестируем /api/characteristics/test/test (GET)..."
response1=$(curl -s -w "%{http_code}" -o /tmp/response1.json http://localhost:3000/api/characteristics/test/test)
if [ "$response1" = "200" ]; then
    echo "   ✅ GET /api/characteristics/test/test - OK"
    cat /tmp/response1.json | head -3
else
    echo "   ❌ GET /api/characteristics/test/test - HTTP $response1"
fi
echo ""

# Тест 2: Actions API
echo "2️⃣ Тестируем /api/actions/execute (POST)..."
response2=$(curl -s -w "%{http_code}" -o /tmp/response2.json -X POST -H "Content-Type: application/json" -d '{"actionId":"test","characterId":"test","zoneId":"test"}' http://localhost:3000/api/actions/execute)
if [ "$response2" = "200" ]; then
    echo "   ✅ POST /api/actions/execute - OK"
    cat /tmp/response2.json | head -3
else
    echo "   ❌ POST /api/actions/execute - HTTP $response2"
fi
echo ""

# Тест 3: Chat API
echo "3️⃣ Тестируем /api/chat/test (POST)..."
response3=$(curl -s -w "%{http_code}" -o /tmp/response3.json -X POST -H "Content-Type: application/json" -d '{"message":"Привет","characterId":"test"}' http://localhost:3000/api/chat/test)
if [ "$response3" = "200" ]; then
    echo "   ✅ POST /api/chat/test - OK"
    cat /tmp/response3.json | head -3
else
    echo "   ❌ POST /api/chat/test - HTTP $response3"
fi
echo ""

# Тест 4: Time API
echo "4️⃣ Тестируем /api/time/advance (POST)..."
response4=$(curl -s -w "%{http_code}" -o /tmp/response4.json -X POST -H "Content-Type: application/json" -d '{"characterId":"test","hours":1}' http://localhost:3000/api/time/advance)
if [ "$response4" = "200" ]; then
    echo "   ✅ POST /api/time/advance - OK"
    cat /tmp/response4.json | head -3
else
    echo "   ❌ POST /api/time/advance - HTTP $response4"
fi
echo ""

# Тест 5: Главная страница
echo "5️⃣ Тестируем главную страницу /..."
response5=$(curl -s -w "%{http_code}" -o /tmp/response5.html http://localhost:3000/)
if [ "$response5" = "200" ]; then
    echo "   ✅ GET / - OK"
    echo "   📄 Заголовок: $(grep -o '<title>[^<]*</title>' /tmp/response5.html | head -1)"
else
    echo "   ❌ GET / - HTTP $response5"
fi
echo ""

# Тест 6: Игровая страница
echo "6️⃣ Тестируем игровую страницу /game..."
response6=$(curl -s -w "%{http_code}" -o /tmp/response6.html http://localhost:3000/game)
if [ "$response6" = "200" ]; then
    echo "   ✅ GET /game - OK"
    echo "   📄 Заголовок: $(grep -o '<title>[^<]*</title>' /tmp/response6.html | head -1)"
else
    echo "   ❌ GET /game - HTTP $response6"
fi
echo ""

# Очищаем временные файлы
rm -f /tmp/response*.json /tmp/response*.html

echo "🏁 Тестирование завершено!"
echo ""
echo "📊 Результаты:"
echo "   - Characteristics API: HTTP $response1"
echo "   - Actions API: HTTP $response2"
echo "   - Chat API: HTTP $response3"
echo "   - Time API: HTTP $response4"
echo "   - Главная страница: HTTP $response5"
echo "   - Игровая страница: HTTP $response6"
echo ""
echo "💡 Для успешного тестирования все endpoints должны возвращать HTTP 200"

