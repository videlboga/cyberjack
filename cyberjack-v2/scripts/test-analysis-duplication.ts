// scripts/test-analysis-duplication.ts

import { PrismaClient } from '@prisma/client'
import { CharacterAIService } from '../lib/character/ai-service'

const prisma = new PrismaClient()

async function testAnalysisDuplication() {
  console.log('🔍 Тестируем дублирование анализа сообщений...')

  try {
    // Получаем первого персонажа
    const character = await prisma.character.findFirst()
    if (!character) {
      console.log('❌ Персонажи не найдены')
      return
    }

    console.log(`👤 Тестируем с персонажем: ${character.name}`)

    // Создаем AI сервис
    const apiKey = process.env.OPENROUTER_API_KEY || 'test-key'
    const aiService = new CharacterAIService(apiKey)

    console.log('\n📝 Отправляем тестовое сообщение...')

    // Отправляем сообщение
    const response = await aiService.generateResponse(
      character.id,
      'Привет, как дела?',
      {
        userId: 'cmfjeu4430000hxhpz4r17ol8',
        context: {
          currentPose: 'default',
          currentAngle: 'front',
          selectedAction: null,
          actionInProgress: false,
          timestamp: new Date().toISOString()
        }
      }
    )

    console.log('✅ Ответ получен:', response.message)
    console.log('📊 Метаданные:', {
      emotion: response.metadata.emotion,
      intent: response.metadata.intent,
      responseTime: response.metadata.responseTime
    })

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testAnalysisDuplication()
