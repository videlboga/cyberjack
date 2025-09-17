// scripts/seed-database.ts

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Начинаем заполнение базы данных...')

  try {
    // 1. Создаем определения характеристик
    await seedCharacteristics()

    // 2. Создаем определения анатомии
    await seedAnatomy()

    // 3. Создаем определения поз
    await seedPoses()

    // 4. Создаем действия
    await seedActions()

    // 5. Создаем оборудование
    await seedEquipment()

    // 6. Создаем персонажей
    await seedCharacters()

    // 7. Создаем сюжетные элементы
    await seedStoryElements()

    console.log('✅ База данных успешно заполнена!')
  } catch (error) {
    console.error('❌ Ошибка при заполнении БД:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// 1. Определения характеристик
async function seedCharacteristics() {
  console.log('📊 Создаем определения характеристик...')

  const characteristics = [
    // Базовые характеристики
    { name: 'Чувствительность', category: 'physical', description: 'Восприимчивость к физическим и эмоциональным воздействиям' },
    { name: 'Выносливость', category: 'physical', description: 'Способность выдерживать физические нагрузки' },
    { name: 'Гибкость', category: 'physical', description: 'Физическая гибкость и способность принимать различные позы' },
    { name: 'Эмоциональная стабильность', category: 'psychological', description: 'Способность контролировать эмоции' },
    { name: 'Адаптивность', category: 'psychological', description: 'Способность приспосабливаться к новым условиям' },
    { name: 'Интеллект', category: 'psychological', description: 'Умственные способности и анализ ситуаций' },
    { name: 'Общительность', category: 'social', description: 'Способность и желание общаться' },
    { name: 'Эмпатия', category: 'social', description: 'Способность понимать эмоции других' },
    { name: 'Доминантность', category: 'social', description: 'Стремление к лидерству и контролю' },
    { name: 'Самооценка', category: 'personality', description: 'Восприятие собственной ценности' },
    { name: 'Оптимизм', category: 'personality', description: 'Вера в лучшее будущее' },
    { name: 'Любопытство', category: 'personality', description: 'Стремление к новым знаниям' },
    { name: 'Сексуальная опытность', category: 'special', description: 'Опыт в интимных отношениях' },
    { name: 'Сопротивляемость', category: 'special', description: 'Способность сопротивляться принуждению' },
    { name: 'Зависимость', category: 'special', description: 'Склонность к эмоциональным зависимостям' },

    // Общие фетиши
    { name: 'Невинность', category: 'fetish', description: 'Склонность к невинному поведению' },
    { name: 'Подчинение', category: 'fetish', description: 'Желание подчиняться' },
    { name: 'Доминирование', category: 'fetish', description: 'Стремление к контролю' },
    { name: 'Мазохизм', category: 'fetish', description: 'Получение удовольствия от боли' },
    { name: 'Садизм', category: 'fetish', description: 'Получение удовольствия от причинения боли' },
    { name: 'Унижение', category: 'fetish', description: 'Удовольствие от унижения' },
    { name: 'Эксгибиционизм', category: 'fetish', description: 'Удовольствие от обнажения' },
    { name: 'Вуайеризм', category: 'fetish', description: 'Удовольствие от наблюдения' },

    // Анатомические фетиши
    { name: 'Фут-фетиш', category: 'anatomy_fetish', description: 'Фетиш на ступни и ноги' },
    { name: 'Анал-фетиш', category: 'anatomy_fetish', description: 'Фетиш на анальную область' },
    { name: 'Брест-фетиш', category: 'anatomy_fetish', description: 'Фетиш на грудь и соски' },
    { name: 'Хенд-фетиш', category: 'anatomy_fetish', description: 'Фетиш на руки и ладони' },
    { name: 'Нек-фетиш', category: 'anatomy_fetish', description: 'Фетиш на шею и горло' }
  ]

  for (const char of characteristics) {
    const existing = await prisma.characteristicDefinition.findFirst({
      where: { name: char.name }
    })

    if (!existing) {
      await prisma.characteristicDefinition.create({
        data: char
      })
    }
  }

  console.log(`✅ Создано ${characteristics.length} определений характеристик`)
}

// 2. Определения анатомии
async function seedAnatomy() {
  console.log('🦴 Создаем определения анатомии...')

  const anatomy = [
    // Основные зоны
    { name: 'Грудь', category: 'main', description: 'Основная область груди' },
    { name: 'Живот', category: 'main', description: 'Область живота' },
    { name: 'Спина', category: 'main', description: 'Область спины' },
    { name: 'Ноги', category: 'main', description: 'Область ног' },
    { name: 'Руки', category: 'main', description: 'Область рук' },

    // Интимные зоны
    { name: 'Вагина', category: 'intimate', description: 'Вагинальная область' },
    { name: 'Анус', category: 'intimate', description: 'Анальная область' },
    { name: 'Клитор', category: 'intimate', description: 'Клиторальная область' },
    { name: 'Соски', category: 'intimate', description: 'Область сосков' },

    // Специальные зоны
    { name: 'Шея', category: 'special', description: 'Область шеи' },
    { name: 'Уши', category: 'special', description: 'Область ушей' },
    { name: 'Ступни', category: 'special', description: 'Область ступней' },
    { name: 'Ладони', category: 'special', description: 'Область ладоней' }
  ]

  for (const part of anatomy) {
    const existing = await prisma.anatomyDefinition.findFirst({
      where: { name: part.name }
    })

    if (!existing) {
      await prisma.anatomyDefinition.create({
        data: part
      })
    }
  }

  console.log(`✅ Создано ${anatomy.length} определений анатомии`)
}

// 3. Определения поз
async function seedPoses() {
  console.log('🎭 Создаем определения поз...')

  const poses = [
    // Базовые позы
    {
      name: 'Стоя',
      category: 'basic',
      description: 'Стандартная поза стоя',
      effects: {},
      requirements: {}
    },
    {
      name: 'Сидя',
      category: 'basic',
      description: 'Поза сидя',
      effects: {},
      requirements: {}
    },
    {
      name: 'Лежа',
      category: 'basic',
      description: 'Поза лежа',
      effects: {},
      requirements: {}
    },
    {
      name: 'На коленях',
      category: 'basic',
      description: 'Поза на коленях',
      effects: {},
      requirements: {}
    },

    // Специальные позы
    {
      name: 'В капсуле',
      category: 'special',
      description: 'Поза в гидро-санайзере',
      effects: {
        sensitivity: '+0.5 per minute',
        max_effect: 20,
        max_time: 40
      },
      requirements: {
        equipment: 'hydro_sanitizer'
      }
    },
    {
      name: 'Связанная для наказания',
      category: 'special',
      description: 'Поза для плети-метронома',
      effects: {
        pain: '+2 per minute',
        fear: '+pain * 0.3',
        submission: '+0.3 per minute'
      },
      requirements: {
        equipment: 'whip_metronome'
      }
    },
    {
      name: 'Под наблюдением',
      category: 'special',
      description: 'Поза под нейронным ревербератором',
      effects: {
        all_effects: '*1.5',
        analytics: '+1 per minute',
        intelligence: '+0.2 per minute'
      },
      requirements: {
        equipment: 'neural_reverberator'
      }
    }
  ]

  for (const pose of poses) {
    const existing = await prisma.poseDefinition.findFirst({
      where: { name: pose.name }
    })

    if (!existing) {
      await prisma.poseDefinition.create({
        data: pose
      })
    }
  }

  console.log(`✅ Создано ${poses.length} определений поз`)
}

// 4. Действия
async function seedActions() {
  console.log('⚡ Создаем действия...')

  const actions = [
    // Категория: Ласка
    {
      name: 'Поглаживание',
      category: 'ласка',
      description: 'Нежное прикосновение рукой',
      intensity: 30,
      formula: {
        baseEffect: 10,
        modifiers: {
          innocence: 0.2,
          sensitivity: 1.0
        }
      },
      requirements: {}
    },
    {
      name: 'Поцелуй',
      category: 'ласка',
      description: 'Мягкое воздействие губами',
      intensity: 25,
      formula: {
        baseEffect: 8,
        modifiers: {
          innocence: 0.15,
          neck_fetish: 0.15
        }
      },
      requirements: {}
    },
    {
      name: 'Массаж',
      category: 'ласка',
      description: 'Ритмичные движения для расслабления',
      intensity: 40,
      formula: {
        baseEffect: 12,
        modifiers: {
          innocence: 0.25,
          foot_fetish: 0.2
        }
      },
      requirements: {}
    },

    // Категория: Пытка
    {
      name: 'Удар',
      category: 'пытка',
      description: 'Резкое физическое воздействие',
      intensity: 60,
      formula: {
        baseEffect: 15,
        modifiers: {
          masochism: 0.2,
          pain: 1.0
        }
      },
      requirements: {}
    },
    {
      name: 'Щипок',
      category: 'пытка',
      description: 'Сжатие кожи пальцами',
      intensity: 45,
      formula: {
        baseEffect: 12,
        modifiers: {
          masochism: 0.15,
          breast_fetish: 0.15
        }
      },
      requirements: {}
    },
    {
      name: 'Укус',
      category: 'пытка',
      description: 'Воздействие зубами',
      intensity: 55,
      formula: {
        baseEffect: 14,
        modifiers: {
          masochism: 0.18,
          neck_fetish: 0.2
        }
      },
      requirements: {}
    },

    // Категория: Стимуляция
    {
      name: 'Щётка',
      category: 'стимуляция',
      description: 'Воздействие щетиной',
      intensity: 50,
      formula: {
        baseEffect: 13,
        modifiers: {
          dependence: 0.3,
          foot_fetish: 0.25
        }
      },
      requirements: {}
    },
    {
      name: 'Вибратор',
      category: 'стимуляция',
      description: 'Вибрационное воздействие',
      intensity: 70,
      formula: {
        baseEffect: 18,
        modifiers: {
          dependence: 0.4,
          anal_fetish: 0.3
        }
      },
      requirements: {}
    },
    {
      name: 'Электрошок',
      category: 'стимуляция',
      description: 'Электрическое воздействие',
      intensity: 80,
      formula: {
        baseEffect: 20,
        modifiers: {
          dependence: 0.5,
          breast_fetish: 0.2
        }
      },
      requirements: {}
    }
  ]

  for (const action of actions) {
    const existing = await prisma.action.findFirst({
      where: { name: action.name }
    })

    if (!existing) {
      await prisma.action.create({
        data: action
      })
    }
  }

  console.log(`✅ Создано ${actions.length} действий`)
}

// 5. Оборудование
async function seedEquipment() {
  console.log('🔧 Создаем оборудование...')

  const equipment = [
    {
      name: 'Гидро-Санайзер',
      category: 'enhancement',
      description: 'Капсула для повышения чувствительности всего тела',
      rarity: 'RARE',
      cost: 1000,
      requirements: {},
      relatedPoseId: null // Будет установлено после создания поз
    },
    {
      name: 'Плеть-Метроном',
      category: 'punishment',
      description: 'Система наказания с ритмичными ударами',
      rarity: 'UNCOMMON',
      cost: 800,
      requirements: {},
      relatedPoseId: null
    },
    {
      name: 'Нейронный ревербератор',
      category: 'analysis',
      description: 'Система разгона ощущений для анализа',
      rarity: 'EPIC',
      cost: 1200,
      requirements: {},
      relatedPoseId: null
    }
  ]

  // Получаем ID поз для связи
  const inCapsulePose = await prisma.poseDefinition.findFirst({ where: { name: 'В капсуле' } })
  const boundPose = await prisma.poseDefinition.findFirst({ where: { name: 'Связанная для наказания' } })
  const observedPose = await prisma.poseDefinition.findFirst({ where: { name: 'Под наблюдением' } })

  for (let i = 0; i < equipment.length; i++) {
    const equip = equipment[i]

    // Связываем оборудование с позами
    if (i === 0) equip.relatedPoseId = inCapsulePose?.id
    if (i === 1) equip.relatedPoseId = boundPose?.id
    if (i === 2) equip.relatedPoseId = observedPose?.id

    const existing = await prisma.equipment.findFirst({
      where: { name: equip.name }
    })

    if (!existing) {
      await prisma.equipment.create({
        data: equip
      })
    }
  }

  console.log(`✅ Создано ${equipment.length} единиц оборудования`)
}

// 6. Персонажи
async function seedCharacters() {
  console.log('👥 Создаем персонажей...')

  const characters = [
    {
      name: 'Анечка',
      description: 'Доверчивый подросток 17 лет с невинным характером',
      age: 17,
      avatar: '/images/characters/anetchka.jpg',
      prompts: {
        personality: 'Невинная, доверчивая, наивная девушка. Быстро привязывается к людям и легко поддается влиянию.',
        speech: 'Говорит тихо, неуверенно, часто использует уменьшительно-ласкательные формы.',
        reactions: 'Легко краснеет, часто плачет от нежности или страха.'
      }
    },
    {
      name: 'Кай',
      description: 'Женственный художник 22 лет, покорный и напуганный',
      age: 22,
      avatar: '/images/characters/kai.jpg',
      prompts: {
        personality: 'Покорный, напуганный, творческий. Художественное восприятие мира, склонность к самокритике.',
        speech: 'Говорит мягко, с элементами художественной лексики.',
        reactions: 'Эмоционально нестабилен, склонен к самокритике.'
      }
    },
    {
      name: 'Линь Сюэжань',
      description: 'Исследовательница 28 лет, добровольно ставшая активом для изучения',
      age: 28,
      avatar: '/images/characters/lin_xuejian.jpg',
      prompts: {
        personality: 'Доминантная, критикующая, интеллектуальная. Анализирует все процессы, добровольно стала активом для исследований.',
        speech: 'Говорит уверенно, использует научную терминологию.',
        reactions: 'Анализирует все происходящее, критикует методы.'
      }
    }
  ]

  for (const char of characters) {
    const existing = await prisma.character.findFirst({
      where: { name: char.name }
    })

    let character
    if (!existing) {
      character = await prisma.character.create({
        data: char
      })
    } else {
      character = existing
    }

    // Создаем характеристики для персонажа
    await createCharacterCharacteristics(character.id, char.name)

    // Создаем анатомию для персонажа
    await createCharacterAnatomy(character.id, char.name)
  }

  console.log(`✅ Создано ${characters.length} персонажей`)
}

// Создание характеристик для персонажа
async function createCharacterCharacteristics(characterId: string, characterName: string) {
  const characteristics = await prisma.characteristicDefinition.findMany()

  // Базовые значения для каждого персонажа
  const baseValues: Record<string, Record<string, number>> = {
    'Анечка': {
      'Чувствительность': 80, 'Выносливость': 40, 'Гибкость': 60, 'Эмоциональная стабильность': 50,
      'Адаптивность': 70, 'Интеллект': 60, 'Общительность': 80, 'Эмпатия': 85, 'Доминантность': 20,
      'Самооценка': 60, 'Оптимизм': 75, 'Любопытство': 70, 'Сексуальная опытность': 10,
      'Сопротивляемость': 30, 'Зависимость': 60, 'Невинность': 90, 'Подчинение': 70,
      'Доминирование': 10, 'Мазохизм': 30, 'Садизм': 5, 'Унижение': 40,
      'Эксгибиционизм': 20, 'Вуайеризм': 15, 'Фут-фетиш': 20, 'Анал-фетиш': 10,
      'Брест-фетиш': 30, 'Хенд-фетиш': 15, 'Нек-фетиш': 25
    },
    'Кай': {
      'Чувствительность': 85, 'Выносливость': 50, 'Гибкость': 75, 'Эмоциональная стабильность': 40,
      'Адаптивность': 60, 'Интеллект': 70, 'Общительность': 60, 'Эмпатия': 80, 'Доминантность': 20,
      'Самооценка': 45, 'Оптимизм': 50, 'Любопытство': 80, 'Сексуальная опытность': 30,
      'Сопротивляемость': 35, 'Зависимость': 70, 'Невинность': 40, 'Подчинение': 80,
      'Доминирование': 15, 'Мазохизм': 60, 'Садизм': 10, 'Унижение': 60,
      'Эксгибиционизм': 40, 'Вуайеризм': 30, 'Фут-фетиш': 40, 'Анал-фетиш': 60,
      'Брест-фетиш': 50, 'Хенд-фетиш': 35, 'Нек-фетиш': 45
    },
    'Линь Сюэжань': {
      'Чувствительность': 60, 'Выносливость': 70, 'Гибкость': 50, 'Эмоциональная стабильность': 80,
      'Адаптивность': 85, 'Интеллект': 90, 'Общительность': 70, 'Эмпатия': 60, 'Доминантность': 80,
      'Самооценка': 85, 'Оптимизм': 70, 'Любопытство': 95, 'Сексуальная опытность': 60,
      'Сопротивляемость': 70, 'Зависимость': 40, 'Невинность': 20, 'Подчинение': 30,
      'Доминирование': 70, 'Мазохизм': 25, 'Садизм': 40, 'Унижение': 35,
      'Эксгибиционизм': 30, 'Вуайеризм': 50, 'Фут-фетиш': 30, 'Анал-фетиш': 20,
      'Брест-фетиш': 25, 'Хенд-фетиш': 40, 'Нек-фетиш': 35
    }
  }

  const values = baseValues[characterName] || {}

  for (const char of characteristics) {
    const value = values[char.name] || 50 // Значение по умолчанию

    const existing = await prisma.characteristic.findFirst({
      where: {
        characterId,
        characteristicDefId: char.id
      }
    })

    if (!existing) {
      await prisma.characteristic.create({
        data: {
          characterId,
          characteristicDefId: char.id,
          currentValue: value,
          baseValue: value
        }
      })
    }
  }
}

// Создание анатомии для персонажа
async function createCharacterAnatomy(characterId: string, characterName: string) {
  const anatomy = await prisma.anatomyDefinition.findMany()

  // Базовые значения чувствительности для каждого персонажа
  const sensitivityValues: Record<string, Record<string, number>> = {
    'Анечка': {
      'Грудь': 70, 'Живот': 60, 'Спина': 50, 'Ноги': 65, 'Руки': 55,
      'Вагина': 80, 'Анус': 70, 'Клитор': 85, 'Соски': 75,
      'Шея': 65, 'Уши': 60, 'Ступни': 55, 'Ладони': 50
    },
    'Кай': {
      'Грудь': 80, 'Живот': 70, 'Спина': 60, 'Ноги': 75, 'Руки': 65,
      'Вагина': 90, 'Анус': 85, 'Клитор': 95, 'Соски': 85,
      'Шея': 75, 'Уши': 70, 'Ступни': 65, 'Ладони': 60
    },
    'Линь Сюэжань': {
      'Грудь': 50, 'Живот': 45, 'Спина': 40, 'Ноги': 55, 'Руки': 50,
      'Вагина': 60, 'Анус': 55, 'Клитор': 65, 'Соски': 55,
      'Шея': 50, 'Уши': 45, 'Ступни': 40, 'Ладони': 45
    }
  }

  const values = sensitivityValues[characterName] || {}

  for (const part of anatomy) {
    const sensitivity = values[part.name] || 50 // Значение по умолчанию

    const existing = await prisma.characterAnatomy.findFirst({
      where: {
        characterId,
        anatomyDefId: part.id
      }
    })

    if (!existing) {
      await prisma.characterAnatomy.create({
        data: {
          characterId,
          anatomyDefId: part.id,
          hasPart: true,
          sensitivity
        }
      })
    }
  }
}

// 7. Сюжетные элементы
async function seedStoryElements() {
  console.log('📖 Создаем сюжетные элементы...')

  // Создаем станцию
  let station = await prisma.stationEntity.findFirst({
    where: { name: 'Отдел снабжения' }
  })

  if (!station) {
    station = await prisma.stationEntity.create({
      data: {
        name: 'Отдел снабжения',
        type: 'shop',
        description: 'Место покупки и продажи активов и оборудования',
        metadata: {
          shop_type: 'assets_and_equipment',
          currency: 'credits'
        }
      }
    })
  }

  // Создаем сцену покупки активов
  let buyAssetsScene = await prisma.scene.findFirst({
    where: { name: 'Покупка активов' }
  })

  if (!buyAssetsScene) {
    buyAssetsScene = await prisma.scene.create({
      data: {
        name: 'Покупка активов',
        description: 'Сцена выбора и покупки активов',
        stationId: station.id,
        triggerConditions: {},
        probability: 100
      }
    })
  }

  // Создаем экран списка активов
  let assetsScreen = await prisma.screen.findFirst({
    where: { name: 'Список доступных активов' }
  })

  if (!assetsScreen) {
    assetsScreen = await prisma.screen.create({
      data: {
        sceneId: buyAssetsScene.id,
        name: 'Список доступных активов',
        description: 'Выбор актива для покупки',
        content: {
          title: 'Доступные активы',
          assets: [
            { id: 'anetchka', name: 'Анечка', price: 500, description: 'Доверчивый подросток 17 лет' },
            { id: 'kai', name: 'Кай', price: 600, description: 'Женственный художник 22 лет' },
            { id: 'lin_xuejian', name: 'Линь Сюэжань', price: 800, description: 'Исследовательница 28 лет' }
          ]
        }
      }
    })
  }

  // Создаем выборы для покупки активов
  const choices = [
    {
      text: 'Купить Анечку (500 кредитов)',
      consequences: { credits: -500, add_character: 'anetchka' }
    },
    {
      text: 'Купить Кая (600 кредитов)',
      consequences: { credits: -600, add_character: 'kai' }
    },
    {
      text: 'Купить Линь Сюэжань (800 кредитов)',
      consequences: { credits: -800, add_character: 'lin_xuejian' }
    }
  ]

  for (const choice of choices) {
    await prisma.choice.create({
      data: {
        screenId: assetsScreen.id,
        text: choice.text,
        consequences: choice.consequences
      }
    })
  }

  console.log('✅ Созданы сюжетные элементы')
}

// Запуск скрипта
main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
