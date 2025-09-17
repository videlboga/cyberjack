// scripts/assign-poses-to-characters.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function assignPosesToCharacters() {
  console.log('🎭 Назначаем позы персонажам...')

  try {
    // Получаем всех персонажей
    const characters = await prisma.character.findMany()
    console.log(`👥 Найдено персонажей: ${characters.length}`)

    // Получаем все позы
    const poses = await prisma.poseDefinition.findMany()
    console.log(`🎭 Найдено поз: ${poses.length}`)

    // Базовые позы для всех персонажей
    const basicPoses = ['Стоя', 'Лежа', 'Сидя', 'На коленях']

    // Дополнительные позы для разных типов персонажей
    const characterPoses = {
      'Анечка': ['Лежа на спине', 'Лежа на животе', 'Стоя на четвереньках'],
      'Кай': ['Стоя с поднятыми руками', 'Лежа на спине', 'Стоя на четвереньках'],
      'Линь Сюэжань': ['Стоя с поднятыми руками', 'Лежа на животе', 'Стоя на четвереньках']
    }

    for (const character of characters) {
      console.log(`\n👤 Назначаем позы для ${character.name}...`)

      // Назначаем базовые позы
      for (const poseName of basicPoses) {
        const pose = poses.find(p => p.name === poseName)
        if (pose) {
          await prisma.characterPose.create({
            data: {
              characterId: character.id,
              poseDefId: pose.id,
              isActive: false,
              isDefault: false
            }
          })
          console.log(`  ✅ Назначена поза: ${poseName}`)
        }
      }

      // Назначаем дополнительные позы для конкретного персонажа
      const additionalPoses = characterPoses[character.name as keyof typeof characterPoses] || []
      for (const poseName of additionalPoses) {
        const pose = poses.find(p => p.name === poseName)
        if (pose) {
          await prisma.characterPose.create({
            data: {
              characterId: character.id,
              poseDefId: pose.id,
              isActive: false,
              isDefault: false
            }
          })
          console.log(`  ✅ Назначена дополнительная поза: ${poseName}`)
        }
      }
    }

    // Проверяем результат
    console.log('\n📊 Проверяем результат:')
    const updatedCharacters = await prisma.character.findMany({
      include: {
        poses: {
          include: {
            definition: true
          }
        }
      }
    })

    for (const character of updatedCharacters) {
      console.log(`\n${character.name}: ${character.poses.length} поз`)
      character.poses.forEach(pose => {
        console.log(`  - ${pose.definition.name}`)
      })
    }

    console.log('\n✅ Позы успешно назначены персонажам!')

  } catch (error) {
    console.error('❌ Ошибка при назначении поз:', error)
  } finally {
    await prisma.$disconnect()
  }
}

assignPosesToCharacters()
