// scripts/activate-pose-for-test.ts

import { prisma } from '../lib/db/client'

async function activatePoseForTest() {
  try {
    const characterId = 'cmfjoy4jz0001hxqgsw4ukrz1'
    const poseId = 'cmfjeu44m0007hxhpup3t6r8t'

    console.log('Создание связи персонажа с позой...')

    // Сначала создаем связь между персонажем и позой
    const result = await prisma.characterPose.upsert({
      where: {
        characterId_poseDefId: {
          characterId,
          poseDefId: poseId
        }
      },
      update: {
        isActive: true
      },
      create: {
        characterId,
        poseDefId: poseId,
        isActive: true,
        customSettings: {}
      }
    })

    console.log('✅ Поза активирована:', result)

    // Проверяем активные позы
    const activePoses = await prisma.characterPose.findMany({
      where: {
        characterId,
        isActive: true
      },
      include: {
        definition: {
          select: {
            id: true,
            name: true,
            category: true
          }
        }
      }
    })

    console.log('Активные позы персонажа:', activePoses.map(p => ({
      id: p.definition.id,
      name: p.definition.name,
      category: p.definition.category,
      isActive: p.isActive
    })))

  } catch (error) {
    console.error('Ошибка:', error)
  }
}

activatePoseForTest()
  .then(() => {
    console.log('Готово!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Критическая ошибка:', error)
    process.exit(1)
  })
