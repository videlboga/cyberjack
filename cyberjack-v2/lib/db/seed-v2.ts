// lib/db/seed-v2.ts - Расширенный скрипт генерации тестовых данных

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Начинаем расширенное заполнение базы данных...')

  // Очищаем базу данных
  await prisma.session.deleteMany()
  await prisma.characterKnowledge.deleteMany()
  await prisma.characterCopy.deleteMany()
  await prisma.activeZone.deleteMany()
  await prisma.poseAngle.deleteMany()
  await prisma.characterPose.deleteMany()
  await prisma.characterAnatomy.deleteMany()
  await prisma.characteristic.deleteMany()
  await prisma.choice.deleteMany()
  await prisma.screen.deleteMany()
  await prisma.scene.deleteMany()
  await prisma.storyPoint.deleteMany()
  await prisma.action.deleteMany()
  await prisma.poseDefinition.deleteMany()
  await prisma.anatomyDefinition.deleteMany()
  await prisma.characteristicDefinition.deleteMany()
  await prisma.character.deleteMany()
  await prisma.user.deleteMany()

  console.log('🧹 База данных очищена')

  // 1. СОЗДАЕМ ПОЛЬЗОВАТЕЛЕЙ
  console.log('👥 Создаем пользователей...')

  const adminUser = await prisma.user.create({
    data: {
      email: 'admin@cyberjack.local',
      name: 'Администратор',
      role: 'SUPER_ADMIN',
      credits: 10000,
      modifiers: { experience: 1.5, efficiency: 1.2 }
    }
  })

  const testUser = await prisma.user.create({
    data: {
      email: 'user@cyberjack.local',
      name: 'Тестовый пользователь',
      role: 'USER',
      credits: 5000,
      modifiers: { experience: 1.0, efficiency: 1.0 }
    }
  })

  console.log(`✅ Создано пользователей: ${adminUser.name}, ${testUser.name}`)

  // 2. СОЗДАЕМ ОПРЕДЕЛЕНИЯ ХАРАКТЕРИСТИК
  console.log('📊 Создаем определения характеристик...')

  const characteristics = [
    // Физическое состояние
    { name: 'Энергия', category: 'Физическое состояние', description: 'Уровень физической энергии', minValue: 0, maxValue: 100 },
    { name: 'Здоровье', category: 'Физическое состояние', description: 'Общее состояние здоровья', minValue: 0, maxValue: 100 },
    { name: 'Выносливость', category: 'Физическое состояние', description: 'Физическая выносливость', minValue: 0, maxValue: 100 },

    // Эмоциональное состояние
    { name: 'Настроение', category: 'Эмоциональное состояние', description: 'Общее эмоциональное состояние', minValue: 0, maxValue: 100 },
    { name: 'Стресс', category: 'Эмоциональное состояние', description: 'Уровень стресса и напряжения', minValue: 0, maxValue: 100 },
    { name: 'Уверенность', category: 'Эмоциональное состояние', description: 'Уровень уверенности в себе', minValue: 0, maxValue: 100 },

    // Сексуальное состояние
    { name: 'Возбуждение', category: 'Сексуальное состояние', description: 'Уровень физического возбуждения', minValue: 0, maxValue: 100 },
    { name: 'Удовлетворенность', category: 'Сексуальное состояние', description: 'Уровень сексуального удовлетворения', minValue: 0, maxValue: 100 },
    { name: 'Чувствительность', category: 'Сексуальное состояние', description: 'Общая чувствительность тела', minValue: 0, maxValue: 100 },

    // Психологическое состояние
    { name: 'Покорность', category: 'Психологическое состояние', description: 'Уровень психологической покорности', minValue: 0, maxValue: 100 },
    { name: 'Стыдливость', category: 'Психологическое состояние', description: 'Уровень стыдливости и застенчивости', minValue: 0, maxValue: 100 },
    { name: 'Зависимость', category: 'Психологическое состояние', description: 'Психологическая зависимость от хозяина', minValue: 0, maxValue: 100 }
  ]

  const characteristicDefs = []
  for (const char of characteristics) {
    const def = await prisma.characteristicDefinition.create({
      data: char
    })
    characteristicDefs.push(def)
  }

  console.log(`✅ Создано определений характеристик: ${characteristicDefs.length}`)

  // 3. СОЗДАЕМ ОПРЕДЕЛЕНИЯ АНАТОМИИ
  console.log('🔬 Создаем определения анатомии...')

  const anatomyDefs = [
    // Основные зоны
    { name: 'Грудь', category: 'Основные зоны', description: 'Основная зона груди' },
    { name: 'Гениталии', category: 'Основные зоны', description: 'Основная зона гениталий' },
    { name: 'Ягодицы', category: 'Основные зоны', description: 'Зона ягодиц' },
    { name: 'Рот', category: 'Основные зоны', description: 'Зона рта и губ' },

    // Дополнительные зоны
    { name: 'Шея', category: 'Дополнительные зоны', description: 'Зона шеи и ключиц' },
    { name: 'Живот', category: 'Дополнительные зоны', description: 'Зона живота' },
    { name: 'Бедра', category: 'Дополнительные зоны', description: 'Зона бедер' },
    { name: 'Спина', category: 'Дополнительные зоны', description: 'Зона спины' },

    // Чувствительные зоны
    { name: 'Соски', category: 'Чувствительные зоны', description: 'Соски груди' },
    { name: 'Клитор', category: 'Чувствительные зоны', description: 'Клитор' },
    { name: 'Внутренние губы', category: 'Чувствительные зоны', description: 'Внутренние половые губы' },
    { name: 'Анус', category: 'Чувствительные зоны', description: 'Анальное отверстие' }
  ]

  const anatomyDefinitions = []
  for (const anatomy of anatomyDefs) {
    const def = await prisma.anatomyDefinition.create({
      data: anatomy
    })
    anatomyDefinitions.push(def)
  }

  console.log(`✅ Создано определений анатомии: ${anatomyDefinitions.length}`)

  // 4. СОЗДАЕМ ОПРЕДЕЛЕНИЯ ПОЗ
  console.log('🧍 Создаем определения поз...')

  const poses = [
    {
      name: 'Стоя',
      category: 'Основные позы',
      description: 'Стоячая поза',
      effects: { energy: -0.1, stress: 0.05 },
      requirements: { energy: 10 }
    },
    {
      name: 'Лежа',
      category: 'Основные позы',
      description: 'Лежачая поза',
      effects: { energy: 0.2, stress: -0.1 },
      requirements: {}
    },
    {
      name: 'На коленях',
      category: 'Покорные позы',
      description: 'Поза на коленях',
      effects: { покорность: 0.15, стыдливость: 0.1, energy: -0.05 },
      requirements: { покорность: 20 }
    },
    {
      name: 'Стоя на четвереньках',
      category: 'Покорные позы',
      description: 'Поза на четвереньках',
      effects: { покорность: 0.2, стыдливость: 0.15, energy: -0.1 },
      requirements: { покорность: 30, energy: 15 }
    },
    {
      name: 'Стоя с поднятыми руками',
      category: 'Покорные позы',
      description: 'Стоя с поднятыми вверх руками',
      effects: { покорность: 0.1, стыдливость: 0.2, energy: -0.15 },
      requirements: { покорность: 15, energy: 20 }
    },
    {
      name: 'Лежа на спине',
      category: 'Расслабленные позы',
      description: 'Лежа на спине',
      effects: { energy: 0.25, stress: -0.15, уверенность: 0.05 },
      requirements: {}
    },
    {
      name: 'Лежа на животе',
      category: 'Расслабленные позы',
      description: 'Лежа на животе',
      effects: { energy: 0.2, stress: -0.1, стыдливость: 0.05 },
      requirements: {}
    },
    {
      name: 'Сидя',
      category: 'Основные позы',
      description: 'Сидячая поза',
      effects: { energy: 0.1 },
      requirements: {}
    }
  ]

  const poseDefinitions = []
  for (const pose of poses) {
    const def = await prisma.poseDefinition.create({
      data: pose
    })
    poseDefinitions.push(def)
  }

  console.log(`✅ Создано определений поз: ${poseDefinitions.length}`)

  // 5. СОЗДАЕМ РАКУРСЫ ДЛЯ ПОЗ
  console.log('📐 Создаем ракурсы поз...')

  const angles = [
    // Стоя
    { poseDefId: poseDefinitions[0].id, name: 'Спереди', angle: 'front' },
    { poseDefId: poseDefinitions[0].id, name: 'Сзади', angle: 'back' },
    { poseDefId: poseDefinitions[0].id, name: 'Сбоку', angle: 'side' },

    // Лежа
    { poseDefId: poseDefinitions[1].id, name: 'Сверху', angle: 'top' },
    { poseDefId: poseDefinitions[1].id, name: 'Сбоку', angle: 'side' },

    // На коленях
    { poseDefId: poseDefinitions[2].id, name: 'Спереди', angle: 'front' },
    { poseDefId: poseDefinitions[2].id, name: 'Сзади', angle: 'back' },

    // На четвереньках
    { poseDefId: poseDefinitions[3].id, name: 'Сзади', angle: 'back' },
    { poseDefId: poseDefinitions[3].id, name: 'Сбоку', angle: 'side' },

    // С поднятыми руками
    { poseDefId: poseDefinitions[4].id, name: 'Спереди', angle: 'front' },

    // Лежа на спине
    { poseDefId: poseDefinitions[5].id, name: 'Сверху', angle: 'top' },
    { poseDefId: poseDefinitions[5].id, name: 'Сбоку', angle: 'side' },

    // Лежа на животе
    { poseDefId: poseDefinitions[6].id, name: 'Сзади', angle: 'back' },
    { poseDefId: poseDefinitions[6].id, name: 'Сбоку', angle: 'side' },

    // Сидя
    { poseDefId: poseDefinitions[7].id, name: 'Спереди', angle: 'front' },
    { poseDefId: poseDefinitions[7].id, name: 'Сбоку', angle: 'side' }
  ]

  const poseAngles = []
  for (const angle of angles) {
    const angleDef = await prisma.poseAngle.create({
      data: {
        ...angle,
        media: { images: [], videos: [], gifs: [] }
      }
    })
    poseAngles.push(angleDef)
  }

  console.log(`✅ Создано ракурсов поз: ${poseAngles.length}`)

  // 6. СОЗДАЕМ АКТИВНЫЕ ЗОНЫ
  console.log('🎯 Создаем активные зоны...')

  const activeZones = [
    // Стоя спереди
    { angleId: poseAngles[0].id, anatomyDefId: anatomyDefinitions[0].id, name: 'Грудь (стоя спереди)', x: 0.5, y: 0.3, width: 0.2, height: 0.15 },
    { angleId: poseAngles[0].id, anatomyDefId: anatomyDefinitions[1].id, name: 'Гениталии (стоя спереди)', x: 0.5, y: 0.7, width: 0.15, height: 0.15 },
    { angleId: poseAngles[0].id, anatomyDefId: anatomyDefinitions[3].id, name: 'Рот (стоя спереди)', x: 0.5, y: 0.15, width: 0.1, height: 0.1 },

    // Стоя сзади
    { angleId: poseAngles[1].id, anatomyDefId: anatomyDefinitions[2].id, name: 'Ягодицы (стоя сзади)', x: 0.5, y: 0.6, width: 0.2, height: 0.2 },
    { angleId: poseAngles[1].id, anatomyDefId: anatomyDefinitions[7].id, name: 'Спина (стоя сзади)', x: 0.5, y: 0.3, width: 0.25, height: 0.4 },

    // Лежа сверху
    { angleId: poseAngles[3].id, anatomyDefId: anatomyDefinitions[0].id, name: 'Грудь (лежа сверху)', x: 0.5, y: 0.25, width: 0.2, height: 0.15 },
    { angleId: poseAngles[3].id, anatomyDefId: anatomyDefinitions[1].id, name: 'Гениталии (лежа сверху)', x: 0.5, y: 0.65, width: 0.15, height: 0.15 },

    // На четвереньках сзади
    { angleId: poseAngles[7].id, anatomyDefId: anatomyDefinitions[2].id, name: 'Ягодицы (четвереньки сзади)', x: 0.5, y: 0.4, width: 0.25, height: 0.25 },
    { angleId: poseAngles[7].id, anatomyDefId: anatomyDefinitions[11].id, name: 'Анус (четвереньки сзади)', x: 0.5, y: 0.5, width: 0.1, height: 0.1 }
  ]

  for (const zone of activeZones) {
    await prisma.activeZone.create({
      data: zone
    })
  }

  console.log(`✅ Создано активных зон: ${activeZones.length}`)

  // 7. СОЗДАЕМ ДЕЙСТВИЯ
  console.log('🎭 Создаем действия...')

  const actions = [
    // Нежные действия
    {
      name: 'Нежные прикосновения',
      category: 'Ласки',
      description: 'Мягкие, нежные прикосновения',
      intensity: 20,
      cost: 5,
      duration: 60,
      effects: { arousal: 10, mood: 5, stress: -5 },
      requirements: {}
    },
    {
      name: 'Поглаживания',
      category: 'Ласки',
      description: 'Медленные поглаживания',
      intensity: 30,
      cost: 8,
      duration: 90,
      effects: { arousal: 15, mood: 8, stress: -8 },
      requirements: {}
    },

    // Интенсивные действия
    {
      name: 'Интенсивные ласки',
      category: 'Ласки',
      description: 'Более интенсивные прикосновения',
      intensity: 60,
      cost: 15,
      duration: 120,
      effects: { arousal: 25, energy: -10, покорность: 5 },
      requirements: { arousal: 20 }
    },
    {
      name: 'Массаж',
      category: 'Ласки',
      description: 'Расслабляющий массаж',
      intensity: 40,
      cost: 12,
      duration: 180,
      effects: { energy: 20, stress: -15, mood: 10 },
      requirements: { energy: 15 }
    },

    // Доминирующие действия
    {
      name: 'Приказ встать',
      category: 'Команды',
      description: 'Приказать встать в определенную позу',
      intensity: 50,
      cost: 10,
      duration: 30,
      effects: { покорность: 15, стыдливость: 10, stress: 5 },
      requirements: { покорность: 10 }
    },
    {
      name: 'Приказ раздеться',
      category: 'Команды',
      description: 'Приказать снять одежду',
      intensity: 70,
      cost: 20,
      duration: 60,
      effects: { покорность: 20, стыдливость: 25, arousal: 15 },
      requirements: { покорность: 25 }
    },

    // Стимуляция
    {
      name: 'Стимуляция груди',
      category: 'Стимуляция',
      description: 'Стимуляция области груди',
      intensity: 65,
      cost: 18,
      duration: 150,
      effects: { arousal: 30, чувствительность: 10, mood: 5 },
      requirements: { arousal: 15 }
    },
    {
      name: 'Стимуляция гениталий',
      category: 'Стимуляция',
      description: 'Стимуляция генитальной области',
      intensity: 80,
      cost: 25,
      duration: 120,
      effects: { arousal: 40, удовлетворенность: 20, энергия: -15 },
      requirements: { arousal: 30 }
    },

    // Наказания
    {
      name: 'Легкое наказание',
      category: 'Наказания',
      description: 'Легкое физическое наказание',
      intensity: 45,
      cost: 15,
      duration: 90,
      effects: { покорность: 10, стыдливость: 15, stress: 10 },
      requirements: { покорность: 20 }
    },
    {
      name: 'Строгое наказание',
      category: 'Наказания',
      description: 'Строгое физическое наказание',
      intensity: 75,
      cost: 30,
      duration: 180,
      effects: { покорность: 25, стыдливость: 30, stress: 20, зависимость: 10 },
      requirements: { покорность: 40 }
    }
  ]

  for (const action of actions) {
    await prisma.action.create({
      data: action
    })
  }

  console.log(`✅ Создано действий: ${actions.length}`)

  // 8. СОЗДАЕМ ПЕРСОНАЖЕЙ
  console.log('👥 Создаем персонажей...')

  const characters = [
    {
      name: 'Алиса',
      description: 'Молодая покорная девушка с невинным взглядом. Очень стыдливая и чувствительная.',
      age: 22,
      prompts: {
        personality: 'Невинная, стыдливая, но постепенно раскрывающаяся. Очень чувствительная к прикосновениям.',
        speech_style: 'Тихий, застенчивый голос. Часто запинается и краснеет.',
        reactions: 'Быстро краснеет, дрожит от стыда, но постепенно расслабляется под влиянием хозяина.'
      }
    },
    {
      name: 'Ева',
      description: 'Опытная и уверенная в себе женщина. Знает, чего хочет, но готова подчиниться.',
      age: 28,
      prompts: {
        personality: 'Уверенная, опытная, но готовая к покорности. Любит доминирование и подчинение.',
        speech_style: 'Уверенный, соблазнительный голос с легкой игривостью.',
        reactions: 'Контролирует свои реакции, но позволяет себе расслабиться в нужный момент.'
      }
    },
    {
      name: 'София',
      description: 'Интеллектуалка, которая открыла для себя мир BDSM. Любит психологические игры.',
      age: 26,
      prompts: {
        personality: 'Умная, аналитичная, но страстная. Любит интеллектуальные игры и психологическое доминирование.',
        speech_style: 'Остроумный, интеллигентный стиль речи с намеками и двусмысленностями.',
        reactions: 'Анализирует свои ощущения, но не может скрыть физические реакции.'
      }
    },
    {
      name: 'Миа',
      description: 'Энергичная и активная девушка, которая нуждается в контроле и дисциплине.',
      age: 24,
      prompts: {
        personality: 'Энергичная, иногда непослушная, но жаждущая дисциплины и контроля.',
        speech_style: 'Быстрая, эмоциональная речь. Иногда дерзкая, но быстро сдающаяся.',
        reactions: 'Эмоциональные, яркие реакции. Борется с собой, но быстро подчиняется.'
      }
    }
  ]

  const createdCharacters = []
  for (const char of characters) {
    const character = await prisma.character.create({
      data: {
        ...char,
        isActive: true
      }
    })
    createdCharacters.push(character)
  }

  console.log(`✅ Создано персонажей: ${createdCharacters.length}`)

  // 9. СОЗДАЕМ ХАРАКТЕРИСТИКИ ДЛЯ ПЕРСОНАЖЕЙ
  console.log('📊 Создаем характеристики для персонажей...')

  const characterStats = [
    // Алиса - невинная и стыдливая
    { characterId: createdCharacters[0].id, stats: { energy: 85, health: 95, endurance: 70, mood: 60, stress: 40, confidence: 30, arousal: 20, satisfaction: 10, sensitivity: 90, submission: 25, shyness: 85, dependency: 15 }},

    // Ева - опытная и уверенная
    { characterId: createdCharacters[1].id, stats: { energy: 75, health: 90, endurance: 85, mood: 80, stress: 20, confidence: 85, arousal: 60, satisfaction: 70, sensitivity: 60, submission: 70, shyness: 20, dependency: 45 }},

    // София - интеллектуалка
    { characterId: createdCharacters[2].id, stats: { energy: 70, health: 85, endurance: 65, mood: 75, stress: 35, confidence: 80, arousal: 45, satisfaction: 40, sensitivity: 70, submission: 55, shyness: 40, dependency: 30 }},

    // Миа - энергичная и непослушная
    { characterId: createdCharacters[3].id, stats: { energy: 95, health: 90, endurance: 90, mood: 70, stress: 60, confidence: 60, arousal: 35, satisfaction: 25, sensitivity: 75, submission: 20, shyness: 30, dependency: 10 }}
  ]

  for (const charStats of characterStats) {
    for (let i = 0; i < characteristicDefs.length; i++) {
      const def = characteristicDefs[i]
      const value = charStats.stats[def.name.toLowerCase()] || 50

      await prisma.characteristic.create({
        data: {
          characterId: charStats.characterId,
          characteristicDefId: def.id,
          currentValue: value,
          baseValue: value,
          recoveryRate: 1.0 + Math.random() * 0.5 // 1.0 - 1.5
        }
      })
    }
  }

  console.log(`✅ Создано характеристик для персонажей`)

  // 10. СОЗДАЕМ АНАТОМИЮ ДЛЯ ПЕРСОНАЖЕЙ
  console.log('🔬 Создаем анатомию для персонажей...')

  for (const character of createdCharacters) {
    for (const anatomyDef of anatomyDefinitions) {
      const hasPart = Math.random() > 0.1 // 90% вероятность наличия части тела
      const sensitivity = hasPart ? 30 + Math.random() * 60 : 0 // 30-90 если есть, 0 если нет

      await prisma.characterAnatomy.create({
        data: {
          characterId: character.id,
          anatomyDefId: anatomyDef.id,
          hasPart,
          sensitivity
        }
      })
    }
  }

  console.log(`✅ Создана анатомия для персонажей`)

  // 11. СОЗДАЕМ ПОЗЫ ДЛЯ ПЕРСОНАЖЕЙ
  console.log('🧍 Создаем позы для персонажей...')

  for (const character of createdCharacters) {
    for (const poseDef of poseDefinitions) {
      await prisma.characterPose.create({
        data: {
          characterId: character.id,
          poseDefId: poseDef.id,
          customSettings: {},
          isActive: true
        }
      })
    }
  }

  console.log(`✅ Созданы позы для персонажей`)

  // 12. СОЗДАЕМ КОПИИ ПЕРСОНАЖЕЙ ДЛЯ ПОЛЬЗОВАТЕЛЕЙ
  console.log('👤 Создаем копии персонажей для пользователей...')

  for (const user of [adminUser, testUser]) {
    for (const character of createdCharacters) {
      await prisma.characterCopy.create({
        data: {
          userId: user.id,
          characterId: character.id,
          settings: {
            unlockedActions: [],
            favoritePoses: [],
            customPrompts: {}
          }
        }
      })
    }
  }

  console.log(`✅ Созданы копии персонажей для пользователей`)

  // 13. СОЗДАЕМ ЗНАНИЯ ПОЛЬЗОВАТЕЛЕЙ О ПЕРСОНАЖАХ
  console.log('🧠 Создаем знания пользователей о персонажах...')

  for (const user of [adminUser, testUser]) {
    for (const character of createdCharacters) {
      // Общие знания о персонаже
      await prisma.characterKnowledge.create({
        data: {
          userId: user.id,
          characterId: character.id,
          level: 'APPROXIMATE',
          lastRevealed: new Date()
        }
      })

      // Знания о характеристиках (частично раскрытые)
      for (let i = 0; i < Math.floor(characteristicDefs.length / 2); i++) {
        const def = characteristicDefs[i]
        const knowledgeLevel = ['UNKNOWN', 'APPROXIMATE', 'DETAILED'][Math.floor(Math.random() * 3)]

        await prisma.characterKnowledge.create({
          data: {
            userId: user.id,
            characterId: character.id,
            characteristicDefId: def.id,
            level: knowledgeLevel as any,
            value: knowledgeLevel !== 'UNKNOWN' ? 50 + Math.random() * 40 : null,
            accuracy: knowledgeLevel === 'PRECISE' ? 0.95 : knowledgeLevel === 'DETAILED' ? 0.8 : 0.6,
            lastRevealed: new Date()
          }
        })
      }
    }
  }

  console.log(`✅ Созданы знания пользователей о персонажах`)

  // 14. СОЗДАЕМ СЮЖЕТНЫЕ ТОЧКИ
  console.log('📖 Создаем сюжетные точки...')

  const storyPoints = [
    { name: 'Уровень доверия', type: 'NUMERIC', category: 'Отношения', description: 'Уровень доверия к хозяину', defaultValue: 0, minValue: 0, maxValue: 100, tags: ['trust', 'relationship'] },
    { name: 'Уровень подчинения', type: 'NUMERIC', category: 'Отношения', description: 'Степень психологического подчинения', defaultValue: 0, minValue: 0, maxValue: 100, tags: ['submission', 'control'] },
    { name: 'Опыт BDSM', type: 'NUMERIC', category: 'Развитие', description: 'Накопленный опыт в BDSM', defaultValue: 0, minValue: 0, maxValue: 100, tags: ['experience', 'learning'] },
    { name: 'Готовность к новому', type: 'NUMERIC', category: 'Состояние', description: 'Готовность попробовать новые действия (0-100)', defaultValue: 0, minValue: 0, maxValue: 100, tags: ['readiness', 'exploration'] },
    { name: 'Текущая фаза', type: 'NUMERIC', category: 'Состояние', description: 'Текущая фаза развития отношений (0-100)', defaultValue: 0, minValue: 0, maxValue: 100, tags: ['phase', 'relationship'] }
  ]

  for (const point of storyPoints) {
    await prisma.storyPoint.create({
      data: point
    })
  }

  console.log(`✅ Создано сюжетных точек: ${storyPoints.length}`)

  // 15. СОЗДАЕМ СЦЕНЫ
  console.log('🎬 Создаем сцены...')

  const scenes = [
    {
      name: 'Первое знакомство',
      type: 'Встреча',
      description: 'Первая встреча с новым персонажем',
      triggerConditions: { trust: { min: 0, max: 20 } },
      probability: 100
    },
    {
      name: 'Исследование тела',
      type: 'Исследование',
      description: 'Исследование анатомии персонажа',
      triggerConditions: { trust: { min: 20, max: 50 } },
      probability: 80
    },
    {
      name: 'Первые команды',
      type: 'Доминирование',
      description: 'Первые попытки дать команды',
      triggerConditions: { trust: { min: 30, max: 70 } },
      probability: 70
    },
    {
      name: 'Интенсивная сессия',
      type: 'Интенсив',
      description: 'Интенсивная BDSM сессия',
      triggerConditions: { trust: { min: 60, max: 100 }, submission: { min: 50 } },
      probability: 50
    }
  ]

  for (const scene of scenes) {
    await prisma.scene.create({
      data: scene
    })
  }

  console.log(`✅ Создано сцен: ${scenes.length}`)

  // 16. СОЗДАЕМ СУЩНОСТИ СТАНЦИИ
  console.log('🏢 Создаем сущности станции...')

  const stationEntities = [
    {
      name: 'Тренировочная комната',
      type: 'Помещение',
      description: 'Комната для тренировок и обучения',
      probability: 30,
      metadata: { size: 'medium', equipment: ['restraints', 'toys'], privacy: 'high' }
    },
    {
      name: 'Общая зона',
      type: 'Помещение',
      description: 'Общая зона для взаимодействия',
      probability: 60,
      metadata: { size: 'large', equipment: ['basic'], privacy: 'medium' }
    },
    {
      name: 'Частная комната',
      type: 'Помещение',
      description: 'Приватная комната для интимного общения',
      probability: 40,
      metadata: { size: 'small', equipment: ['full'], privacy: 'maximum' }
    }
  ]

  for (const entity of stationEntities) {
    await prisma.stationEntity.create({
      data: entity
    })
  }

  console.log(`✅ Создано сущностей станции: ${stationEntities.length}`)

  // ФИНАЛЬНАЯ СТАТИСТИКА
  console.log('')
  console.log('🎉 РАСШИРЕННОЕ ЗАПОЛНЕНИЕ БАЗЫ ДАННЫХ ЗАВЕРШЕНО!')
  console.log('')
  console.log('📊 Создано:')
  console.log(`   👥 Пользователей: 2`)
  console.log(`   📊 Определений характеристик: ${characteristicDefs.length}`)
  console.log(`   🔬 Определений анатомии: ${anatomyDefinitions.length}`)
  console.log(`   🧍 Определений поз: ${poseDefinitions.length}`)
  console.log(`   📐 Ракурсов поз: ${poseAngles.length}`)
  console.log(`   🎯 Активных зон: ${activeZones.length}`)
  console.log(`   🎭 Действий: ${actions.length}`)
  console.log(`   👥 Персонажей: ${createdCharacters.length}`)
  console.log(`   📊 Характеристик персонажей: ${createdCharacters.length * characteristicDefs.length}`)
  console.log(`   🔬 Анатомии персонажей: ${createdCharacters.length * anatomyDefinitions.length}`)
  console.log(`   🧍 Поз персонажей: ${createdCharacters.length * poseDefinitions.length}`)
  console.log(`   👤 Копий персонажей: ${2 * createdCharacters.length}`)
  console.log(`   🧠 Записей знаний: ${2 * createdCharacters.length * (1 + Math.floor(characteristicDefs.length / 2))}`)
  console.log(`   📖 Сюжетных точек: ${storyPoints.length}`)
  console.log(`   🎬 Сцен: ${scenes.length}`)
  console.log(`   🏢 Сущностей станции: ${stationEntities.length}`)
  console.log('')
  console.log('🚀 База данных готова к тестированию!')
}

main()
  .catch((e) => {
    console.error('❌ Ошибка при заполнении базы данных:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
