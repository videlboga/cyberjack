// Тест подключения к OpenRouter
const fs = require('fs');
const path = require('path');

// Загружаем переменные окружения
const envPath = path.join(__dirname, '../.env');
const envContent = fs.readFileSync(envPath, 'utf8');

// Парсим переменные окружения
const envVars = {};
envContent.split('\n').forEach(line => {
  if (line.includes('=') && !line.startsWith('#')) {
    const [key, value] = line.split('=');
    if (key && value) {
      envVars[key.trim()] = value.trim().replace(/"/g, '');
    }
  }
});

const apiKey = envVars.OPENAI_API_KEY;
const geminiModel = envVars.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY;

console.log('🔍 Тест подключения к OpenRouter...\n');

console.log('📋 Переменные окружения:');
console.log(`   OPENAI_API_KEY: ${apiKey ? 'Установлен' : 'НЕ УСТАНОВЛЕН'}`);
console.log(`   NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY: ${geminiModel || 'НЕ УСТАНОВЛЕН'}`);

if (!apiKey) {
  console.error('❌ OPENAI_API_KEY не найден в .env файле');
  process.exit(1);
}

if (!geminiModel) {
  console.error('❌ NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY не найден в .env файле');
  process.exit(1);
}

// Тестируем подключение к OpenRouter
async function testOpenRouter() {
  try {
    console.log('\n🔄 Тестируем подключение к OpenRouter...');
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'CyberJack Test'
      },
      body: JSON.stringify({
        model: geminiModel,
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
    
  } catch (error) {
    console.error('❌ Ошибка подключения:', error.message);
  }
}

// Запускаем тест
testOpenRouter();













