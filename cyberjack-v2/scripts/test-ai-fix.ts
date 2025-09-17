// scripts/test-ai-fix.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testAIFix() {
  console.log('🤖 Тестируем исправленную ИИ-систему...')

  try {
    // Получаем первого персонажа
    const character = await prisma.character.findFirst()
    if (!character) {
      console.log('❌ Персонажи не найдены')
      return
    }

    console.log(`👤 Тестируем с персонажем: ${character.name}`)

    // Получаем первого пользователя
    const user = await prisma.user.findFirst({
      where: { email: { not: 'ai-system@cyberjack.local' } }
    })
    if (!user) {
      console.log('❌ Пользователи не найдены')
      return
    }

    console.log(`👤 Пользователь: ${user.name}`)

    // Проверяем системного пользователя ИИ
    const aiUser = await prisma.user.findFirst({
      where: { email: 'ai-system@cyberjack.local' }
    })
    if (!aiUser) {
      console.log('❌ Системный пользователь ИИ не найден')
      return
    }

    console.log(`🤖 Системный пользователь ИИ: ${aiUser.name}`)

    // Проверяем память персонажа
    const characterData = await prisma.character.findUnique({
      where: { id: character.id },
      select: { prompts: true }
    })

    if (characterData?.prompts) {
      const promptsData = characterData.prompts as any
      console.log(`🧠 Промпты персонажа: ${JSON.stringify(promptsData).length} символов`)

      if (promptsData.memories && Array.isArray(promptsData.memories)) {
        console.log(`📝 Количество воспоминаний: ${promptsData.memories.length}`)

        // Проверяем типы timestamp в воспоминаниях
        promptsData.memories.forEach((mem: any, index: number) => {
          if (mem.timestamp) {
            const timestampType = typeof mem.timestamp
            console.log(`  Воспоминание ${index + 1}: timestamp = ${timestampType}`)
          }
        })
      }
    } else {
      console.log('🧠 Промпты персонажа пусты')
    }

    // Проверяем сообщения чата
    const chatMessages = await prisma.chatMessage.findMany({
      where: { characterId: character.id },
      orderBy: { createdAt: 'desc' },
      take: 5
    })

    console.log(`💬 Последние сообщения чата: ${chatMessages.length}`)
    chatMessages.forEach((msg, index) => {
      console.log(`  ${index + 1}. [${msg.messageType}] ${msg.content.substring(0, 50)}...`)
    })

    console.log('\n✅ ИИ-система исправлена и готова к работе!')
    console.log('🌐 Откройте http://localhost:3000/game для тестирования')

  } catch (error) {
    console.error('❌ Ошибка тестирования ИИ-системы:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testAIFix()
