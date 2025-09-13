// scripts/seed-database.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Начинаем заполнение базы данных...')

  // Создаем определения характеристик
  const characteristics = await Promise.all([
    prisma.characteristicDefinition.upsert({
      where: { id: 'mood' },
      update: {},
      create: {
        id: 'mood',
        name: 'Настроение',
        category: 'Эмоциональное',
        description: 'Общее эмоциональное состояние персонажа',
        minValue: 0,
        maxValue: 100,
        isActive: true
      }
    }),
    prisma.characteristicDefinition.upsert({
      where: { id: 'energy' },
      update: {},
      create: {
        id: 'energy',
        name: 'Энергия',
        category: 'Физическое',
        description: 'Уровень физической энергии',
        minValue: 0,
        maxValue: 100,
        isActive: true
      }
    }),
    prisma.characteristicDefinition.upsert({
      where: { id: 'comfort' },
      update: {},
      create: {
        id: 'comfort',
        name: 'Комфорт',
        category: 'Физическое',
        description: 'Уровень физического комфорта',
        minValue: 0,
        maxValue: 100,
        isActive: true
      }
    })
  ])

  console.log('✅ Созданы определения характеристик:', characteristics.length)

  // Создаем определения анатомии
  const anatomy = await Promise.all([
    prisma.anatomyDefinition.upsert({
      where: { id: 'head' },
      update: {},
      create: {
        id: 'head',
        name: 'Голова',
        category: 'Основные',
        description: 'Голова персонажа',
        isActive: true
      }
    }),
    prisma.anatomyDefinition.upsert({
      where: { id: 'chest' },
      update: {},
      create: {
        id: 'chest',
        name: 'Грудь',
        category: 'Основные',
        description: 'Область груди',
        isActive: true
      }
    })
  ])

  console.log('✅ Созданы определения анатомии:', anatomy.length)

  // Создаем действия
  const actions = await Promise.all([
    prisma.action.upsert({
      where: { id: 'hug' },
      update: {},
      create: {
        id: 'hug',
        name: 'Обнять',
        category: 'Ласка',
        description: 'Нежное объятие',
        intensity: 20,
        cost: 5,
        duration: 10,
        effects: JSON.stringify({
          mood: { change: 15, permanent: false },
          comfort: { change: 10, permanent: false }
        }),
        requirements: JSON.stringify({}),
        isActive: true
      }
    }),
    prisma.action.upsert({
      where: { id: 'kiss' },
      update: {},
      create: {
        id: 'kiss',
        name: 'Поцеловать',
        category: 'Ласка',
        description: 'Нежный поцелуй',
        intensity: 30,
        cost: 8,
        duration: 5,
        effects: JSON.stringify({
          mood: { change: 25, permanent: false },
          energy: { change: -5, permanent: false }
        }),
        requirements: JSON.stringify({}),
        isActive: true
      }
    })
  ])

  console.log('✅ Созданы действия:', actions.length)

  // Создаем тестового персонажа
  const character = await prisma.character.upsert({
    where: { id: 'test-character' },
    update: {},
    create: {
      id: 'test-character',
      name: 'Анна',
      description: 'Дружелюбная и отзывчивая девушка с добрым сердцем',
      age: 22,
      avatar: null,
      isActive: true,
      prompts: JSON.stringify({
        personality: 'Дружелюбная, заботливая, немного застенчивая',
        speech_style: 'Мягкая, вежливая, использует уменьшительные формы',
        background: 'Студентка, изучает психологию'
      })
    }
  })

  console.log('✅ Создан тестовый персонаж:', character.name)

  // Создаем характеристики для персонажа
  const characterCharacteristics = await Promise.all([
    prisma.characteristic.upsert({
      where: {
        characterId_characteristicDefId: {
          characterId: character.id,
          characteristicDefId: 'mood'
        }
      },
      update: {},
      create: {
        characterId: character.id,
        characteristicDefId: 'mood',
        currentValue: 75,
        baseValue: 70,
        recoveryRate: 1.0,
        shiftThreshold: 60,
        shiftRate: 0.1,
        timeInAlteredState: 0
      }
    }),
    prisma.characteristic.upsert({
      where: {
        characterId_characteristicDefId: {
          characterId: character.id,
          characteristicDefId: 'energy'
        }
      },
      update: {},
      create: {
        characterId: character.id,
        characteristicDefId: 'energy',
        currentValue: 80,
        baseValue: 85,
        recoveryRate: 1.5,
        shiftThreshold: 60,
        shiftRate: 0.1,
        timeInAlteredState: 0
      }
    }),
    prisma.characteristic.upsert({
      where: {
        characterId_characteristicDefId: {
          characterId: character.id,
          characteristicDefId: 'comfort'
        }
      },
      update: {},
      create: {
        characterId: character.id,
        characteristicDefId: 'comfort',
        currentValue: 90,
        baseValue: 85,
        recoveryRate: 1.0,
        shiftThreshold: 60,
        shiftRate: 0.1,
        timeInAlteredState: 0
      }
    })
  ])

  console.log('✅ Созданы характеристики персонажа:', characterCharacteristics.length)

  // Создаем анатомию для персонажа
  const characterAnatomy = await Promise.all([
    prisma.characterAnatomy.upsert({
      where: {
        characterId_anatomyDefId: {
          characterId: character.id,
          anatomyDefId: 'head'
        }
      },
      update: {},
      create: {
        characterId: character.id,
        anatomyDefId: 'head',
        hasPart: true,
        sensitivity: 60
      }
    }),
    prisma.characterAnatomy.upsert({
      where: {
        characterId_anatomyDefId: {
          characterId: character.id,
          anatomyDefId: 'chest'
        }
      },
      update: {},
      create: {
        characterId: character.id,
        anatomyDefId: 'chest',
        hasPart: true,
        sensitivity: 70
      }
    })
  ])

  console.log('✅ Создана анатомия персонажа:', characterAnatomy.length)

  // Создаем тестового пользователя
  const user = await prisma.user.upsert({
    where: { id: 'test-user' },
    update: {},
    create: {
      id: 'test-user',
      email: 'test@example.com',
      name: 'Тестовый пользователь',
      role: 'USER',
      modifiers: JSON.stringify({
        mood: 1.0,
        energy: 1.0,
        comfort: 1.0
      }),
      credits: 1000
    }
  })

  console.log('✅ Создан тестовый пользователь:', user.name)

  console.log('🎉 База данных успешно заполнена!')
  console.log('\n📊 Статистика:')
  console.log(`- Характеристик: ${characteristics.length}`)
  console.log(`- Анатомии: ${anatomy.length}`)
  console.log(`- Действий: ${actions.length}`)
  console.log(`- Персонажей: 1`)
  console.log(`- Пользователей: 1`)
}

main()
  .catch((e) => {
    console.error('❌ Ошибка при заполнении базы данных:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
