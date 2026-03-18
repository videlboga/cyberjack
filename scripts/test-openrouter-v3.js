// Тест подключения к OpenRouter с новой переменной
const fs = require('fs');
const path = require('path');

// Загружаем переменные окружения из .env если dotenv доступен
try {
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (_) {
  // dotenv не установлен — используем переменные окружения напрямую
}

const apiKey = process.env.OPENROUTER_API_KEY;
const model = process.env.OPENROUTER_MODEL || 'z-ai/glm-4.5';

console.log('🔍 Тест подключения к OpenRouter с новой переменной...\n');

console.log('📋 Переменные окружения:');
console.log(`   OPENROUTER_API_KEY: ${apiKey ? (apiKey.length > 6 ? apiKey.substring(0, 6) + '...' + ` (len=${apiKey.length})` : `[key too short] (len=${apiKey.length})`) : 'НЕ УСТАНОВЛЕН'}`);
console.log(`   OPENROUTER_MODEL: ${model}`);

if (!apiKey) {
  console.error('❌ OPENROUTER_API_KEY не найден в переменных окружения');
  process.exit(1);
}

// Тестируем подключение к OpenRouter
async function testOpenRouter() {
  try {
    console.log('\n🔄 Тестируем подключение к OpenRouter...');
    console.log(`🔑 Используем API ключ: ${apiKey.length > 6 ? apiKey.substring(0, 6) + '...' + ` (len=${apiKey.length})` : `[key too short] (len=${apiKey.length})`}`);
    console.log(`🤖 Используем модель: ${model}`);
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'CyberJack Test'
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'user',
            content: 'Привет! Это тест подключения. Ответь одним словом: "Работает"'
          }
        ],
        temperature: 0.7,
        max_tokens: 50
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Ошибка API: ${response.status} - ${errorText}`);
      return;
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    console.log('✅ Подключение успешно!');
    console.log(`📥 Ответ от ИИ: "${content}"`);
    console.log(`💰 Использовано токенов: ${data.usage?.total_tokens || 'неизвестно'}`);
    console.log(`🤖 Модель: ${data.model || 'неизвестно'}`);
    
  } catch (error) {
    console.error('❌ Ошибка подключения:', error.message);
  }
}

// Запускаем тест
testOpenRouter();













