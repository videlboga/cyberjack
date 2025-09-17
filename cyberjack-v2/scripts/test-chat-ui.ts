// scripts/test-chat-ui.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testChatUI() {
  console.log('💬 Тестируем интерфейс чата...')

  try {
    // Получаем первого персонажа
    const character = await prisma.character.findFirst()
    if (!character) {
      console.log('❌ Персонажи не найдены')
      return
    }

    console.log(`👤 Тестируем с персонажем: ${character.name}`)

    // Очищаем старые сообщения для чистого теста
    await prisma.chatMessage.deleteMany({
      where: { characterId: character.id }
    })

    console.log('🧹 Очистили старые сообщения')

    // Создаем тестовое сообщение пользователя
    const userMessage = await prisma.chatMessage.create({
      data: {
        content: 'Привет! Это тестовое сообщение.',
        senderId: 'cmfjeu4430000hxhpz4r17ol8', // ID админа
        characterId: character.id,
        messageType: 'user',
        emotionalTone: 'positive'
      }
    })

    console.log(`✅ Создано сообщение пользователя: ${userMessage.id}`)

    // Ждем немного
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Создаем ответ персонажа
    const aiUser = await prisma.user.findFirst({
      where: { email: 'ai-system@cyberjack.local' }
    })

    if (aiUser) {
      const characterMessage = await prisma.chatMessage.create({
        data: {
          content: 'Привет! Как дела? Я готова к тестированию.',
          senderId: aiUser.id,
          characterId: character.id,
          messageType: 'character',
          emotionalTone: 'positive'
        }
      })

      console.log(`✅ Создан ответ персонажа: ${characterMessage.id}`)
    }

    // Проверяем сообщения
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

    console.log('\n✅ Тест завершен!')
    console.log('🌐 Откройте http://localhost:3000/game для проверки интерфейса')
    console.log('📝 Теперь сообщения пользователя должны отображаться сразу после отправки')

  } catch (error) {
    console.error('❌ Ошибка тестирования:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testChatUI()
