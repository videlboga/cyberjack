// Тестовый скрипт для проверки интеграции AI-системы
const { personalWorkIntegration } = require('../lib/character/personal-work-integration.ts')

async function testAIIntegration() {
  console.log('🧪 Тестирование интеграции AI-системы...')
  
  try {
    // Тестовый персонаж
    const testTalent = {
      id: 'test-character-1',
      name: 'Анна',
      stats: {
        intelligence: 75,
        creativity: 80,
        charisma: 70,
        technical: 65
      },
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

    // Тестовый контекст
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

    console.log('📝 Отправка тестового сообщения...')
    
    const response = await personalWorkIntegration.processMessage({
      talentId: testTalent.id,
      message: 'Привет! Как дела?',
      context: testContext,
      interactionType: 'общение',
      selectedTool: 'communicator',
      equipment: []
    })

    console.log('✅ Ответ AI-системы:')
    console.log('Сообщение:', response.message)
    console.log('Изменения:', response.changes)
    console.log('Эмоциональное состояние:', response.emotionalState)
    console.log('Активированные фетиши:', response.fetishActivations)

    console.log('🎉 Тест завершен успешно!')
    
  } catch (error) {
    console.error('❌ Ошибка тестирования:', error)
  }
}

// Запуск теста
testAIIntegration()
