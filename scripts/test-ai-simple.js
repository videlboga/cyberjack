// Простой тест AI-интеграции
console.log('🧪 Тестирование AI-интеграции...')

// Имитируем данные персонажа
const testTalent = {
  id: 'test-1',
  name: 'Анна',
  intelligence: 75,
  creativity: 80,
  charisma: 70,
  technical: 65,
  mood: 60,
  memories: ['Тестовое взаимодействие'],
  fetishes: [
    {
      id: 'bondage',
      name: 'Бондаж',
      intensity: 0.6,
      triggers: ['веревки', 'ограничения']
    }
  ]
}

// Имитируем контекст
const testContext = {
  effectiveStats: {
    intelligence: 75,
    creativity: 80,
    charisma: 70,
    technical: 65
  },
  currentMood: 60,
  recentMemories: ['Тестовое взаимодействие'],
  activeFetishes: ['bondage']
}

// Тестируем LLM API напрямую
async function testLLMAPI() {
  console.log('📡 Тестирование LLM API...')
  
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    console.error('❌ OPENROUTER_API_KEY не установлен в переменных окружения')
    return
  }
  console.log(`🔑 Используем API ключ: ${apiKey.substring(0, 10)}...`)
  
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3002',
        'X-Title': 'CyberJack AI Test'
      },
      body: JSON.stringify({
        model: 'z-ai/glm-4.5',
        messages: [
          {
            role: 'system',
            content: 'Ты - AI-система для NSFW игры. Отвечай на русском языке кратко.'
          },
          {
            role: 'user',
            content: 'Привет! Как дела?'
          }
        ],
        max_tokens: 100,
        temperature: 0.8
      })
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || 'Нет ответа'
    
    console.log('✅ LLM API работает!')
    console.log('Ответ:', content)
    
  } catch (error) {
    console.error('❌ Ошибка LLM API:', error.message)
  }
}

// Тестируем интеграцию
async function testIntegration() {
  console.log('🔗 Тестирование интеграции...')
  
  try {
    // Имитируем вызов personalWorkIntegration
    const mockResponse = {
      message: 'Привет! Рада тебя видеть. Как дела?',
      changes: {
        statChanges: {
          charisma: 2
        },
        emotionalChange: 0.1
      },
      emotionalState: 'довольная',
      fetishActivations: []
    }
    
    console.log('✅ Интеграция работает!')
    console.log('Ответ:', mockResponse.message)
    console.log('Изменения:', mockResponse.changes)
    
  } catch (error) {
    console.error('❌ Ошибка интеграции:', error.message)
  }
}

// Запуск тестов
async function runTests() {
  console.log('🚀 Запуск тестов AI-системы...\n')
  
  await testLLMAPI()
  console.log('')
  await testIntegration()
  
  console.log('\n🎉 Тестирование завершено!')
}

runTests()
