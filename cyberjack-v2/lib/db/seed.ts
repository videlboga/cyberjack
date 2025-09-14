// lib/db/seed.ts - Базовый скрипт заполнения

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Начинаем базовое заполнение базы данных...')
  console.log('💡 Для расширенного заполнения используйте: npx tsx lib/db/seed-v2.ts')

  // Создаем тестового пользователя
  const testUser = await prisma.user.upsert({
    where: { email: 'admin@cyberjack.local' },
    update: {},
    create: {
      email: 'admin@cyberjack.local',
      name: 'Администратор',
      role: 'SUPER_ADMIN',
      credits: 10000,
      modifiers: {}
    }
  })

  console.log(`👤 Создан пользователь: ${testUser.name} (${testUser.email})`)

  // Создаем базовые определения характеристик
  let moodDef = await prisma.characteristicDefinition.findFirst({
    where: { name: 'Настроение' }
  })
  if (!moodDef) {
    moodDef = await prisma.characteristicDefinition.create({
      data: {
        name: 'Настроение',
        category: 'Эмоциональное состояние',
        description: 'Общее эмоциональное состояние персонажа',
        minValue: 0,
        maxValue: 100,
        isActive: true
      }
    })
  }

  let energyDef = await prisma.characteristicDefinition.findFirst({
    where: { name: 'Энергия' }
  })
  if (!energyDef) {
    energyDef = await prisma.characteristicDefinition.create({
      data: {
        name: 'Энергия',
        category: 'Физическое состояние',
        description: 'Уровень физической энергии',
        minValue: 0,
        maxValue: 100,
        isActive: true
      }
    })
  }

  let arousalDef = await prisma.characteristicDefinition.findFirst({
    where: { name: 'Возбуждение' }
  })
  if (!arousalDef) {
    arousalDef = await prisma.characteristicDefinition.create({
      data: {
        name: 'Возбуждение',
        category: 'Сексуальное состояние',
        description: 'Уровень физического возбуждения',
        minValue: 0,
        maxValue: 100,
        isActive: true
      }
    })
  }

  // Создаем базовые определения анатомии
  let breastDef = await prisma.anatomyDefinition.findFirst({
    where: { name: 'Грудь' }
  })
  if (!breastDef) {
    breastDef = await prisma.anatomyDefinition.create({
      data: {
        name: 'Грудь',
        category: 'Основные зоны',
        description: 'Основная зона груди',
        isActive: true
      }
    })
  }

  let genitalsDef = await prisma.anatomyDefinition.findFirst({
    where: { name: 'Гениталии' }
  })
  if (!genitalsDef) {
    genitalsDef = await prisma.anatomyDefinition.create({
      data: {
        name: 'Гениталии',
        category: 'Основные зоны',
        description: 'Основная зона гениталий',
        isActive: true
      }
    })
  }

  // Создаем базовые определения поз
  const standingDef = await prisma.poseDefinition.upsert({
    where: { name: 'Стоя' },
    update: {},
    create: {
      name: 'Стоя',
      category: 'Основные позы',
      description: 'Стоячая поза',
      effects: { energy: -0.1 },
      requirements: {},
      isActive: true
    }
  })

  const lyingDef = await prisma.poseDefinition.upsert({
    where: { name: 'Лежа' },
    update: {},
    create: {
      name: 'Лежа',
      category: 'Основные позы',
      description: 'Лежачая поза',
      effects: { energy: 0.2 },
      requirements: {},
      isActive: true
    }
  })

  // Создаем ракурсы для поз
  const standingFront = await prisma.poseAngle.upsert({
    where: {
      poseDefId_name: {
        poseDefId: standingDef.id,
        name: 'Спереди'
      }
    },
    update: {},
    create: {
      poseDefId: standingDef.id,
      name: 'Спереди',
      angle: 'front',
      media: { images: [], videos: [], gifs: [] }
    }
  })

  const lyingFront = await prisma.poseAngle.upsert({
    where: {
      poseDefId_name: {
        poseDefId: lyingDef.id,
        name: 'Спереди'
      }
    },
    update: {},
    create: {
      poseDefId: lyingDef.id,
      name: 'Спереди',
      angle: 'front',
      media: { images: [], videos: [], gifs: [] }
    }
  })

  // Создаем активные зоны
  await prisma.activeZone.upsert({
    where: { angleId_name: { angleId: standingFront.id, name: 'Зона груди (стоя)' } },
    update: {},
    create: {
      angleId: standingFront.id,
      anatomyDefId: breastDef.id,
      name: 'Зона груди (стоя)',
      x: 0.5,
      y: 0.3,
      width: 0.2,
      height: 0.15
    }
  })

  await prisma.activeZone.upsert({
    where: { angleId_name: { angleId: lyingFront.id, name: 'Зона груди (лежа)' } },
    update: {},
    create: {
      angleId: lyingFront.id,
      anatomyDefId: breastDef.id,
      name: 'Зона груди (лежа)',
      x: 0.5,
      y: 0.25,
      width: 0.2,
      height: 0.15
    }
  })

  // Создаем базовые действия
  await prisma.action.upsert({
    where: { id: 'soft-caresses' },
    update: {},
    create: {
      id: 'soft-caresses',
      name: 'Нежные прикосновения',
      category: 'Ласки',
      description: 'Мягкие, нежные прикосновения',
      intensity: 20,
      formula: {},
      requirements: {},
      isActive: true
    }
  })

  await prisma.action.upsert({
    where: { id: 'intense-caresses' },
    update: {},
    create: {
      id: 'intense-caresses',
      name: 'Интенсивные ласки',
      category: 'Ласки',
      description: 'Более интенсивные прикосновения',
      intensity: 60,
      formula: {},
      requirements: {},
      isActive: true
    }
  })

  // Создаем тестового персонажа
  const testCharacter = await prisma.character.upsert({
    where: { id: 'test-character' },
    update: {},
    create: {
      id: 'test-character',
      name: 'Тестовая персонаж',
      description: 'Тестовый персонаж для разработки',
      age: 25,
      avatar: null,
      isActive: true,
      prompts: {
        personality: 'Дружелюбная и открытая',
        speech_style: 'Мягкий и нежный тон',
        reactions: 'Естественные и эмоциональные'
      }
    }
  })

  // Создаем характеристики для тестового персонажа
  await prisma.characteristic.upsert({
    where: {
      characterId_characteristicDefId: {
        characterId: testCharacter.id,
        characteristicDefId: moodDef.id
      }
    },
    update: {},
    create: {
      characterId: testCharacter.id,
      characteristicDefId: moodDef.id,
      currentValue: 70,
      baseValue: 70,
      recoveryRate: 1.0
    }
  })

  await prisma.characteristic.upsert({
    where: {
      characterId_characteristicDefId: {
        characterId: testCharacter.id,
        characteristicDefId: energyDef.id
      }
    },
    update: {},
    create: {
      characterId: testCharacter.id,
      characteristicDefId: energyDef.id,
      currentValue: 80,
      baseValue: 80,
      recoveryRate: 1.5
    }
  })

  await prisma.characteristic.upsert({
    where: {
      characterId_characteristicDefId: {
        characterId: testCharacter.id,
        characteristicDefId: arousalDef.id
      }
    },
    update: {},
    create: {
      characterId: testCharacter.id,
      characteristicDefId: arousalDef.id,
      currentValue: 30,
      baseValue: 30,
      recoveryRate: 0.8
    }
  })

  // Создаем анатомию для тестового персонажа
  await prisma.characterAnatomy.upsert({
    where: {
      characterId_anatomyDefId: {
        characterId: testCharacter.id,
        anatomyDefId: breastDef.id
      }
    },
    update: {},
    create: {
      characterId: testCharacter.id,
      anatomyDefId: breastDef.id,
      hasPart: true,
      sensitivity: 70
    }
  })

  await prisma.characterAnatomy.upsert({
    where: {
      characterId_anatomyDefId: {
        characterId: testCharacter.id,
        anatomyDefId: genitalsDef.id
      }
    },
    update: {},
    create: {
      characterId: testCharacter.id,
      anatomyDefId: genitalsDef.id,
      hasPart: true,
      sensitivity: 85
    }
  })

  // Создаем позы для тестового персонажа
  await prisma.characterPose.upsert({
    where: {
      characterId_poseDefId: {
        characterId: testCharacter.id,
        poseDefId: standingDef.id
      }
    },
    update: {},
    create: {
      characterId: testCharacter.id,
      poseDefId: standingDef.id,
      customSettings: {}
    }
  })

  await prisma.characterPose.upsert({
    where: {
      characterId_poseDefId: {
        characterId: testCharacter.id,
        poseDefId: lyingDef.id
      }
    },
    update: {},
    create: {
      characterId: testCharacter.id,
      poseDefId: lyingDef.id,
      customSettings: {}
    }
  })

  console.log('✅ База данных успешно заполнена!')
  console.log(`📊 Создано:`)
  console.log(`   - 3 определения характеристик`)
  console.log(`   - 2 определения анатомии`)
  console.log(`   - 2 определения поз`)
  console.log(`   - 2 ракурса поз`)
  console.log(`   - 2 активные зоны`)
  console.log(`   - 2 действия`)
  console.log(`   - 1 тестовый персонаж с характеристиками, анатомией и позами`)
}

main()
  .catch((e) => {
    console.error('❌ Ошибка при заполнении базы данных:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
