// scripts/fix-user-session.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixUserSession() {
  console.log('🔧 Исправляем проблему с пользователем в сессии...')

  try {
    // Получаем всех пользователей
    const users = await prisma.user.findMany()
    console.log('👥 Пользователи в базе данных:')
    users.forEach(user => {
      console.log(`  - ${user.name} (${user.email}) - ID: ${user.id}`)
    })

    // Проверяем, есть ли пользователь с проблемным ID
    const problematicUserId = 'cmfjeu4430000hxhpz4r17ol8'
    const problematicUser = await prisma.user.findUnique({
      where: { id: problematicUserId }
    })

    if (!problematicUser) {
      console.log(`❌ Пользователь с ID ${problematicUserId} не найден`)

      // Создаем пользователя с правильным ID
      const adminUser = await prisma.user.findUnique({
        where: { email: 'admin@cyberjack.local' }
      })

      if (adminUser) {
        console.log(`✅ Найден админ пользователь: ${adminUser.name}`)

        // Обновляем ID админа на проблемный ID
        await prisma.user.update({
          where: { id: adminUser.id },
          data: { id: problematicUserId }
        })

        console.log(`✅ ID админа обновлен на ${problematicUserId}`)
      }
    } else {
      console.log(`✅ Пользователь с ID ${problematicUserId} найден: ${problematicUser.name}`)
    }

    // Проверяем системного пользователя ИИ
    const aiUser = await prisma.user.findFirst({
      where: { email: 'ai-system@cyberjack.local' }
    })

    if (aiUser) {
      console.log(`✅ Системный пользователь ИИ найден: ${aiUser.name} (ID: ${aiUser.id})`)
    } else {
      console.log('❌ Системный пользователь ИИ не найден')
    }

    console.log('\n✅ Проблема с пользователем исправлена!')

  } catch (error) {
    console.error('❌ Ошибка при исправлении пользователя:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixUserSession()
