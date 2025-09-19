import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugPoseMedia() {
  try {
    console.log('🔍 Проверяем медиа в позах...')
    
    // Получаем персонажа с позами
    const character = await prisma.character.findFirst({
      where: { id: 'cmfn0xxiv006chxmqcyx0bnqf' },
      include: {
        poses: {
          include: {
            definition: {
              include: {
                angles: true
              }
            },
            angles: true
          }
        }
      }
    })

    if (!character) {
      console.log('❌ Персонаж не найден')
      return
    }

    console.log(`📋 Персонаж: ${character.name}`)
    console.log(`📊 Количество поз: ${character.poses.length}`)

    for (const pose of character.poses) {
      console.log(`\n🎭 Поза: ${pose.definition.name} (ID: ${pose.id})`)
      console.log(`   Дефолтная: ${pose.isDefault}`)
      console.log(`   Активная: ${pose.isActive}`)
      
      // Проверяем персонализированные ракурсы
      console.log(`   📐 Персонализированные ракурсы: ${pose.angles.length}`)
      for (const angle of pose.angles) {
        console.log(`      - ${angle.name} (ID: ${angle.id})`)
        console.log(`        Медиа:`, JSON.stringify(angle.media, null, 2))
      }
      
      // Проверяем общие ракурсы
      console.log(`   📐 Общие ракурсы: ${pose.definition.angles.length}`)
      for (const angle of pose.definition.angles) {
        console.log(`      - ${angle.name} (ID: ${angle.id})`)
        console.log(`        Медиа:`, JSON.stringify(angle.media, null, 2))
      }
    }

  } catch (error) {
    console.error('❌ Ошибка:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugPoseMedia()
