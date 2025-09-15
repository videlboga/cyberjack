import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function addBasicPoses() {
  console.log('🔧 Добавление базовых поз...')

  try {
    // Удаляем все существующие позы
    console.log('🗑️ Удаление старых поз...')
    await prisma.characterPose.deleteMany()
    await prisma.poseDefinition.deleteMany()

    // Создаем новые определения поз
    console.log('📝 Создание новых определений поз...')

    const poses = [
      {
        name: 'На коленях',
        category: 'Базовые позы',
        description: 'Персонаж стоит на коленях, спина прямая, руки могут быть свободными или связанными',
        effects: {
          'Покорность': { change: 0.2, permanent: false },
          'Усталость': { change: 5, permanent: false }
        },
        requirements: {
          'Гибкость': { min: 3 }
        }
      },
      {
        name: 'На четвереньках',
        category: 'Базовые позы',
        description: 'Персонаж стоит на руках и коленях, спина параллельна полу',
        effects: {
          'Покорность': { change: 0.3, permanent: false },
          'Усталость': { change: 8, permanent: false },
          'Унижение': { change: 10, permanent: false }
        },
        requirements: {
          'Гибкость': { min: 4 },
          'Выносливость': { min: 3 }
        }
      },
      {
        name: 'Лёжа на животе',
        category: 'Базовые позы',
        description: 'Персонаж лежит лицом вниз, руки могут быть свободными или связанными за спиной',
        effects: {
          'Покорность': { change: 0.2, permanent: false },
          'Усталость': { change: -3, permanent: false },
          'Унижение': { change: 5, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'Лёжа на спине',
        category: 'Базовые позы',
        description: 'Персонаж лежит лицом вверх, руки могут быть свободными или связанными',
        effects: {
          'Покорность': { change: 0.1, permanent: false },
          'Усталость': { change: -5, permanent: false },
          'Уязвимость': { change: 15, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'Стоя',
        category: 'Базовые позы',
        description: 'Персонаж стоит прямо, ноги вместе или слегка расставлены',
        effects: {
          'Гордость': { change: 0.1, permanent: false },
          'Усталость': { change: 2, permanent: false }
        },
        requirements: {
          'Выносливость': { min: 2 }
        }
      },
      {
        name: 'Сидя',
        category: 'Базовые позы',
        description: 'Персонаж сидит, спина прямая или слегка наклонена',
        effects: {
          'Усталость': { change: -2, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'Сидя на корточках',
        category: 'Базовые позы',
        description: 'Персонаж сидит на корточках, ноги согнуты, спина прямая',
        effects: {
          'Покорность': { change: 0.2, permanent: false },
          'Усталость': { change: 5, permanent: false },
          'Унижение': { change: 8, permanent: false }
        },
        requirements: {
          'Гибкость': { min: 3 },
          'Выносливость': { min: 2 }
        }
      },
      {
        name: 'Связанная',
        category: 'Базовые позы',
        description: 'Персонаж в любом положении, но с связанными руками или ногами',
        effects: {
          'Покорность': { change: 0.4, permanent: false },
          'Унижение': { change: 15, permanent: false },
          'Страх': { change: 10, permanent: false },
          'Беспомощность': { change: 20, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'В позе молитвы',
        category: 'Базовые позы',
        description: 'Персонаж стоит на коленях, руки сложены в молитве или подняты вверх',
        effects: {
          'Покорность': { change: 0.5, permanent: false },
          'Унижение': { change: 20, permanent: false },
          'Усталость': { change: 8, permanent: false },
          'Стыд': { change: 12, permanent: false }
        },
        requirements: {
          'Гибкость': { min: 3 },
          'Выносливость': { min: 3 }
        }
      },
      {
        name: 'В позе покорности',
        category: 'Базовые позы',
        description: 'Персонаж стоит на коленях, голова опущена, руки за спиной',
        effects: {
          'Покорность': { change: 0.6, permanent: false },
          'Унижение': { change: 25, permanent: false },
          'Усталость': { change: 10, permanent: false },
          'Стыд': { change: 15, permanent: false }
        },
        requirements: {
          'Гибкость': { min: 4 },
          'Выносливость': { min: 4 }
        }
      }
    ]

    // Создаем определения поз
    for (const pose of poses) {
      await prisma.poseDefinition.create({
        data: pose
      })
    }

    console.log(`✅ Создано ${poses.length} определений поз`)

    // Создаем позы для всех существующих персонажей
    console.log('👥 Создание поз для персонажей...')

    const characters = await prisma.character.findMany()
    const poseDefinitions = await prisma.poseDefinition.findMany()

    for (const character of characters) {
      for (const def of poseDefinitions) {
        await prisma.characterPose.create({
          data: {
            characterId: character.id,
            poseDefId: def.id,
            customSettings: {},
            isActive: true
          }
        })
      }
    }

    console.log(`✅ Созданы позы для ${characters.length} персонажей`)

    console.log('🎉 Базовые позы успешно добавлены!')
    console.log(`📊 Всего поз: ${poses.length}`)
    console.log(`📊 Категории: ${[...new Set(poses.map(p => p.category))].join(', ')}`)

  } catch (error) {
    console.error('❌ Ошибка при добавлении поз:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем скрипт
addBasicPoses()
  .then(() => {
    console.log('✅ Скрипт завершен успешно')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Ошибка выполнения скрипта:', error)
    process.exit(1)
  })
