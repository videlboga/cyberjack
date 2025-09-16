// scripts/test-action-context.ts

import { prisma } from '../lib/db/client'
import { CharacterAIService } from '../lib/character/ai-service'

async function testActionContext() {
  console.log('🧪 Тестируем передачу информации о последних действиях в контекст...\n')

  try {
    // Создаем AI сервис
    const aiService = new CharacterAIService(
      process.env.OPENROUTER_API_KEY || '',
      'https://openrouter.ai/api/v1',
      'google/gemini-2.0-flash-exp'
    )

    const characterId = 'cmfkv6rlo0002hxtm7atmgy6r'
    const userId = 'cmfjeu4430000hxhpz4r17ol8'

    // Получаем контекст персонажа
    console.log('📋 Получаем контекст персонажа...')
    const context = await aiService.getCharacterContextWithDynamicPrompts(characterId, userId)

    console.log('✅ Контекст получен:')
    console.log('  - Character ID:', context.characterId)
    console.log('  - User ID:', context.userId)
    console.log('  - Характеристик:', context.characteristics.length)
    console.log('  - Текущая поза:', context.currentPose?.name || 'не установлена')
    console.log('  - Последнее действие:', context.lastAction ? `${context.lastAction.actionName} (${context.lastAction.intensity}/100)` : 'нет')
    console.log('  - История сессии:', context.sessionHistory.length, 'действий')

    if (context.lastAction) {
      console.log('\n📊 Детали последнего действия:')
      console.log('  - Название:', context.lastAction.actionName)
      console.log('  - Категория:', context.lastAction.actionCategory)
      console.log('  - Интенсивность:', context.lastAction.intensity)
      console.log('  - Длительность:', context.lastAction.duration)
      console.log('  - Время назад:', Math.round(context.lastAction.timeAgo / 1000), 'секунд')
      console.log('  - Эффекты:', context.lastAction.effects?.length || 0)
    }

    if (context.sessionHistory.length > 0) {
      console.log('\n📈 История сессии:')
      context.sessionHistory.forEach((action, index) => {
        console.log(`  ${index + 1}. ${action.actionName} (${action.actionCategory}) - ${action.intensity}/100`)
      })
    }

    // Тестируем генерацию ответа
    console.log('\n🤖 Тестируем генерацию ответа с контекстом...')
    const response = await aiService.generateResponse(
      characterId,
      'Расскажи, что ты помнишь о наших последних взаимодействиях',
      { userId }
    )

    console.log('✅ Ответ получен:')
    console.log('  - Сообщение:', response.message)
    console.log('  - Эмоция:', response.metadata.emotion)
    console.log('  - Интент:', response.metadata.intent)
    console.log('  - Время ответа:', response.metadata.responseTime, 'мс')

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testActionContext()
