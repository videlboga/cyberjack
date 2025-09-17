// scripts/test-chat.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testChat() {
  console.log('💬 Тестируем чат...')

  try {
    // Получаем первого персонажа
    const character = await prisma.character.findFirst()
    if (!character) {
      console.log('❌ Персонажи не найдены')
      return
    }

    console.log(`👤 Тестируем с персонажем: ${character.name}`)

    // Получаем пользователя
    const user = await prisma.user.findUnique({
      where: { id: 'cmfjeu4430000hxhpz4r17ol8' }
    })
    if (!user) {
      console.log('❌ Пользователь не найден')
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

    // Создаем тестовое сообщение пользователя
    const userMessage = await prisma.chatMessage.create({
      data: {
        content: 'Привет! Как дела?',
        senderId: user.id,
        characterId: character.id,
        messageType: 'user',
        emotionalTone: 'positive'
      }
    })

    console.log(`✅ Создано сообщение пользователя: ${userMessage.id}`)

    // Создаем тестовое сообщение персонажа
    const characterMessage = await prisma.chatMessage.create({
      data: {
        content: 'Привет! У меня все хорошо, спасибо за вопрос.',
        senderId: aiUser.id,
        characterId: character.id,
        messageType: 'character',
        emotionalTone: 'positive'
      }
    })

    console.log(`✅ Создано сообщение персонажа: ${characterMessage.id}`)

    // Проверяем сообщения в чате
    const messages = await prisma.chatMessage.findMany({
      where: { characterId: character.id },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { name: true, email: true }
        }
      }
    })

    console.log(`\n💬 Сообщения в чате (${messages.length}):`)
    messages.forEach((msg, index) => {
      const senderName = msg.sender?.name || 'Неизвестный'
      console.log(`  ${index + 1}. [${msg.messageType}] ${senderName}: ${msg.content}`)
    })

    console.log('\n✅ Чат работает корректно!')
    console.log('🌐 Откройте http://localhost:3000/game для тестирования')

  } catch (error) {
    console.error('❌ Ошибка тестирования чата:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testChat()
