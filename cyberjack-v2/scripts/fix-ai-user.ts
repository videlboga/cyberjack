// scripts/fix-ai-user.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createAISystemUser() {
  console.log('🤖 Создаем системного пользователя для ИИ...')

  try {
    // Проверяем, есть ли уже системный пользователь
    const existingAIUser = await prisma.user.findFirst({
      where: { email: 'ai-system@cyberjack.local' }
    })

    if (existingAIUser) {
      console.log('✅ Системный пользователь ИИ уже существует')
      return existingAIUser
    }

    // Создаем системного пользователя для ИИ
    const aiUser = await prisma.user.create({
      data: {
        email: 'ai-system@cyberjack.local',
        name: 'AI System',
        role: 'ADMIN',
        modifiers: {
          ai_system: true,
          general: 1.0
        },
        credits: 999999
      }
    })

    console.log('✅ Создан системный пользователь ИИ:', aiUser.id)
    return aiUser
  } catch (error) {
    console.error('❌ Ошибка создания системного пользователя ИИ:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

createAISystemUser()
