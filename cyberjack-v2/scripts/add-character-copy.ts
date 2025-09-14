import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addCharacterCopy() {
  console.log('👤 Добавление копии персонажа пользователю...')

  try {
    // Находим тестового пользователя
    const user = await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    })

    if (!user) {
      console.log('❌ Тестовый пользователь не найден')
      return
    }

    // Находим первого персонажа
    const character = await prisma.character.findFirst({
      where: { isActive: true }
    })

    if (!character) {
      console.log('❌ Активные персонажи не найдены')
      return
    }

    // Проверяем, есть ли уже копия
    const existingCopy = await prisma.characterCopy.findFirst({
      where: {
        userId: user.id,
        characterId: character.id
      }
    })

    if (existingCopy) {
      console.log(`⚠️  Копия персонажа "${character.name}" уже существует у пользователя "${user.name}"`)
      return
    }

    // Добавляем копию персонажа
    const characterCopy = await prisma.characterCopy.create({
      data: {
        userId: user.id,
        characterId: character.id,
        settings: {
          customName: `${character.name} (копия)`,
          preferences: {
            favoriteActions: ['talk', 'comfort'],
            difficulty: 'normal'
          }
        }
      },
      include: {
        character: {
          select: {
            id: true,
            name: true,
            description: true
          }
        }
      }
    })

    console.log(`✅ Добавлена копия персонажа "${character.name}" пользователю "${user.name}"`)
    console.log(`   Настройки:`, characterCopy.settings)

    console.log('🎉 Копия персонажа успешно добавлена!')
  } catch (error) {
    console.error('❌ Ошибка добавления копии персонажа:', error)
  } finally {
    await prisma.$disconnect()
  }
}

addCharacterCopy()
