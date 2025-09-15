#!/usr/bin/env tsx

import { prisma } from '../lib/db/client'
import { ChatFormulaSystem } from '../lib/core/chat/chat-formula-system'

async function testChatFormulas() {
  console.log('💬 Тестируем систему чата с формулами...\n')

  try {
    const chatFormulaSystem = new ChatFormulaSystem()

    // Получаем первого пользователя и персонажа
    const user = await prisma.user.findFirst()
    const character = await prisma.character.findFirst()

    if (!user || !character) {
      console.error('❌ Не найдены пользователь или персонаж для тестирования')
      return
    }

    console.log(`👤 Пользователь: ${user.name} (${user.id})`)
    console.log(`🎭 Персонаж: ${character.name} (${character.id})`)

    // Тестовые сообщения
    const testMessages = [
      {
        content: 'Ты такая красивая! Я восхищаюсь тобой!',
        expectedTone: 'positive'
      },
      {
        content: 'Ты ужасная! Я ненавижу тебя!',
        expectedTone: 'negative'
      },
      {
        content: 'Привет, как дела?',
        expectedTone: 'neutral'
      },
      {
        content: 'Спасибо за заботу! Ты так нежна со мной!',
        expectedTone: 'positive'
      },
      {
        content: 'Ты глупая и бесполезная!',
        expectedTone: 'negative'
      }
    ]

    for (const testMessage of testMessages) {
      console.log(`\n📝 Тестируем сообщение: "${testMessage.content}"`)
      console.log(`🎯 Ожидаемый тон: ${testMessage.expectedTone}`)

      const chatMessage = {
        id: `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
        content: testMessage.content,
        senderId: user.id,
        characterId: character.id,
        timestamp: new Date(),
        messageType: 'user' as const
      }

      try {
        const result = await chatFormulaSystem.processUserMessage(
          chatMessage,
          character.id,
          user.id
        )

        console.log(`✅ Результат:`)
        console.log(`   📊 Эффекты: ${result.effects.length}`)
        for (const effect of result.effects) {
          console.log(`      - ${effect.characteristicId}: ${effect.change > 0 ? '+' : ''}${effect.change} (${effect.permanent ? 'постоянно' : 'временно'})`)
        }
        console.log(`   💬 Ответ: ${result.message}`)
        console.log(`   ✅ Успех: ${result.success}`)

      } catch (error) {
        console.error(`❌ Ошибка при обработке сообщения:`, error)
      }
    }

    console.log('\n🎉 Тестирование завершено!')

  } catch (error) {
    console.error('❌ Критическая ошибка:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем тест
testChatFormulas().catch(console.error)
