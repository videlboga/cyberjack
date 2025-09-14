// scripts/create-test-auto-pose.ts

import { prisma } from '../lib/db/client'

async function createTestAutoPose() {
  try {
    console.log('Создание тестовой автоматической позы...')

    const characterId = 'cmfjoy4jz0001hxqgsw4ukrz1'

    // Создаем позу "Усталость" которая активируется при низком настроении
    const pose = await prisma.poseDefinition.create({
      data: {
        name: 'Усталость',
        category: 'Автоматические позы',
        description: 'Поза активируется автоматически при низком настроении',
        requirements: {
          conditions: [
            {
              id: 'auto_condition_1',
              type: 'characteristic',
              target: 'character.mood',
              operator: 'lte',
              value: 20,
              description: 'Настроение <= 20'
            }
          ]
        },
        effects: {
          effects: [
            {
              id: 'auto_effect_1',
              type: 'characteristic',
              target: 'character.mood',
              formula: 'character.mood - 1',
              frequency: 'per_minute',
              description: 'Снижает настроение на 1 каждую минуту'
            }
          ],
          modifiers: []
        }
      }
    })

    console.log('✅ Поза создана:', pose.name, pose.id)

    // Создаем связь между персонажем и позой
    const characterPose = await prisma.characterPose.create({
      data: {
        characterId,
        poseDefId: pose.id,
        isActive: false,
        customSettings: {}
      }
    })

    console.log('✅ Связь персонажа с позой создана:', characterPose.id)

    // Создаем позу "Радость" которая активируется при высоком настроении
    const happyPose = await prisma.poseDefinition.create({
      data: {
        name: 'Радость',
        category: 'Автоматические позы',
        description: 'Поза активируется автоматически при высоком настроении',
        requirements: {
          conditions: [
            {
              id: 'auto_condition_2',
              type: 'characteristic',
              target: 'character.mood',
              operator: 'gte',
              value: 80,
              description: 'Настроение >= 80'
            }
          ]
        },
        effects: {
          effects: [
            {
              id: 'auto_effect_2',
              type: 'characteristic',
              target: 'character.mood',
              formula: 'character.mood + 0.5',
              frequency: 'per_minute',
              description: 'Повышает настроение на 0.5 каждую минуту'
            }
          ],
          modifiers: []
        }
      }
    })

    console.log('✅ Поза создана:', happyPose.name, happyPose.id)

    // Создаем связь между персонажем и позой радости
    const happyCharacterPose = await prisma.characterPose.create({
      data: {
        characterId,
        poseDefId: happyPose.id,
        isActive: false,
        customSettings: {}
      }
    })

    console.log('✅ Связь персонажа с позой радости создана:', happyCharacterPose.id)

    console.log('\n🎉 Тестовые автоматические позы созданы!')
    console.log('Теперь можно тестировать автоматическое применение поз')

  } catch (error) {
    console.error('❌ Ошибка при создании тестовых поз:', error)
  }
}

createTestAutoPose()
  .then(() => {
    console.log('Готово!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('Критическая ошибка:', error)
    process.exit(1)
  })
