import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testPoseLoading() {
  try {
    console.log('🔍 Тестируем загрузку поз...')
    
    const characterId = 'cmfn0xxiv006chxmqcyx0bnqf'
    const userId = 'test-user-id'
    
    // Получаем персонажа с позами
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: {
        poses: {
          where: { isActive: true },
          include: {
            definition: true,
            angles: {
              include: {
                zones: true
              }
            }
          }
        }
      }
    })

    if (!character) {
      console.log('❌ Персонаж не найден')
      return
    }

    console.log(`📋 Персонаж: ${character.name}`)
    console.log(`📊 Количество активных поз: ${character.poses.length}`)

    // Проверяем каждую позу
    for (const pose of character.poses) {
      console.log(`\n🎭 Поза: ${pose.definition.name} (ID: ${pose.id})`)
      console.log(`   Дефолтная: ${pose.isDefault}`)
      console.log(`   Персонализированные ракурсы: ${pose.angles.length}`)
      
      for (const angle of pose.angles) {
        console.log(`      - ${angle.name} (ID: ${angle.id})`)
        const media = angle.media as any || { images: [], files: [] }
        console.log(`        Медиа:`, JSON.stringify(media, null, 2))
        
        // Проверяем, есть ли медиа
        const hasMedia = (media.images && media.images.length > 0) || (media.files && media.files.length > 0)
        console.log(`        Есть медиа: ${hasMedia}`)
      }
    }

    // Проверяем копию персонажа
    const characterCopy = await prisma.characterCopy.findFirst({
      where: {
        characterId,
        userId
      }
    })

    if (characterCopy) {
      console.log(`\n📋 Копия персонажа найдена:`)
      console.log(`   Настройки:`, JSON.stringify(characterCopy.settings, null, 2))
    } else {
      console.log(`\n⚠️ Копия персонажа не найдена для userId: ${userId}`)
    }

  } catch (error) {
    console.error('❌ Ошибка:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testPoseLoading()
