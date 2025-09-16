// test-interpretations-api.js
// Тест новой системы интерпретации через API

async function testInterpretationsAPI() {
  console.log('🧪 Тестируем новую систему интерпретации через API...\n')

  try {
    // Тестируем создание персонажа с характеристиками
    const testCharacter = {
      name: 'Тестовая персона',
      description: 'Персона для тестирования интерпретаций',
      characteristics: [
        {
          name: 'Энергия',
          category: 'Состояние',
          currentValue: 75,
          baseValue: 50,
          recentChange: 15
        },
        {
          name: 'Настроение',
          category: 'Эмоциональные',
          currentValue: 60,
          baseValue: 40,
          recentChange: 20
        },
        {
          name: 'Стыд',
          category: 'Эмоциональные',
          currentValue: 85,
          baseValue: 70,
          recentChange: -10
        }
      ]
    }

    console.log('📊 Тестовые характеристики:')
    testCharacter.characteristics.forEach(char => {
      console.log(`- ${char.name}: ${char.currentValue}/100 (изменение: ${char.recentChange > 0 ? '+' : ''}${char.recentChange})`)
    })

    // Тестируем чат с персонажем
    console.log('\n💬 Тестируем чат с персонажем...')

    const response = await fetch('http://localhost:3000/api/chat/test-character', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Привет! Как дела?',
        characterId: 'test-character',
        characteristics: testCharacter.characteristics
      })
    })

    if (response.ok) {
      const data = await response.json()
      console.log('✅ Ответ персонажа:', data.message)
    } else {
      console.log('❌ Ошибка API:', response.status, response.statusText)
    }

  } catch (error) {
    console.error('❌ Ошибка теста:', error.message)
  }

  console.log('\n✅ Тест завершен!')
}

// Запускаем тест
testInterpretationsAPI()
