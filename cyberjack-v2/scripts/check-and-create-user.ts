// scripts/check-and-create-user.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAndCreateUser() {
  console.log('🔍 Проверяем пользователей в базе данных...')

  try {
    // Получаем всех пользователей
    const users = await prisma.user.findMany()
    console.log('👥 Пользователи в базе данных:')

    if (users.length === 0) {
      console.log('❌ Пользователи не найдены')

      // Создаем тестового пользователя
      const testUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Test User',
          role: 'SUPER_ADMIN',
          modifiers: {
            general: 1.0,
            test_user: true
          },
          credits: 10000,
          gameTime: 0
        }
      })

      console.log('✅ Создан тестовый пользователь:', testUser.id)
      return testUser
    } else {
      users.forEach(user => {
        console.log(`  - ${user.name} (${user.email}) - ID: ${user.id} - GameTime: ${user.gameTime}`)
      })

      // Проверяем, есть ли пользователь с gameTime
      const userWithTime = users.find(user => user.gameTime !== null)
      if (!userWithTime) {
        console.log('⚠️  У пользователей нет игрового времени, обновляем...')

        // Обновляем первого пользователя
        const firstUser = users[0]
        await prisma.user.update({
          where: { id: firstUser.id },
          data: { gameTime: 0 }
        })

        console.log(`✅ Обновлен игровой время для пользователя ${firstUser.name}`)
      }

      return users[0]
    }
  } catch (error) {
    console.error('❌ Ошибка при проверке пользователей:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

checkAndCreateUser()
