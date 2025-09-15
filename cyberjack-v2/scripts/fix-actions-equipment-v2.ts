import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixActionsAndEquipment() {
  console.log('🔧 Исправление системы действий и оборудования...')

  try {
    // Удаляем все существующие действия и оборудование
    console.log('🗑️ Удаление старых действий и оборудования...')
    await prisma.actionLog.deleteMany()
    await prisma.action.deleteMany()
    await prisma.userEquipment.deleteMany()
    await prisma.equipment.deleteMany()

    // Создаем новые действия (интерактивные действия)
    console.log('📝 Создание новых действий...')

    const actions = [
      // Ручные инструменты пыток
      {
        name: 'Нейронный осциллятор',
        category: 'Ручные инструменты',
        description: 'Квантовый осциллятор с нейронной синхронизацией для сенсорного тестирования',
        intensity: 30,
        formula: {
          'Чувствительность': { change: 0.3, permanent: false },
          'Возбуждение': { change: 10, permanent: false },
          'Усталость': { change: 5, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'Тактильный стимулятор',
        category: 'Ручные инструменты',
        description: 'Нейротактильная перчатка с микроэлектродами для сенсорной стимуляции',
        intensity: 25,
        formula: {
          'Чувствительность': { change: 0.4, permanent: false },
          'Смех': { change: 15, permanent: false },
          'Усталость': { change: 8, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'Фонаторный супрессор',
        category: 'Ручные инструменты',
        description: 'Акустический супрессор с квантовыми фильтрами для вокального подавления',
        intensity: 20,
        formula: {
          'Самооценка': { change: -0.3, permanent: false },
          'Унижение': { change: 12, permanent: false },
          'Злость': { change: 5, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'Электромагнитный импульсор',
        category: 'Ручные инструменты',
        description: 'Импульсный генератор с адаптивной электромагнитной модуляцией',
        intensity: 40,
        formula: {
          'Чувствительность': { change: 0.4, permanent: false },
          'Боль': { change: 15, permanent: false },
          'Страх': { change: 8, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'Ректо-анализатор',
        category: 'Специализированные инструменты',
        description: 'Биометрический зонд с адаптивными сенсорами для ректо-анального исследования',
        intensity: 35,
        formula: {
          'Анал-фетиш': { change: 0.5, permanent: false },
          'Дискомфорт': { change: 12, permanent: false },
          'Возбуждение': { change: 10, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'Клиторальный модулятор',
        category: 'Специализированные инструменты',
        description: 'Нейромодулятор с точечным воздействием для клиторальной стимуляции',
        intensity: 30,
        formula: {
          'Чувствительность': { change: 0.4, permanent: false },
          'Возбуждение': { change: 15, permanent: false },
          'Перегрузка': { change: 6, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'Терморегулятор',
        category: 'Специализированные инструменты',
        description: 'Квантовый терморегулятор с градиентным температурным контролем',
        intensity: 35,
        formula: {
          'Чувствительность': { change: 0.5, permanent: false },
          'Шок': { change: 10, permanent: false },
          'Усталость': { change: 8, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'Компрессионный пресс',
        category: 'Специализированные инструменты',
        description: 'Гидравлический компрессор с биометрической обратной связью',
        intensity: 45,
        formula: {
          'Чувствительность': { change: 0.6, permanent: false },
          'Боль': { change: 18, permanent: false },
          'Онемение': { change: 5, permanent: false }
        },
        requirements: {}
      },

      // Вербальные взаимодействия
      {
        name: 'Грубость',
        category: 'Вербальные взаимодействия',
        description: 'Жесткий, агрессивный, commanding стиль общения',
        intensity: 20,
        formula: {
          'Подчинение': { change: 10, permanent: false },
          'Самооценка': { change: -5, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'Нежность',
        category: 'Вербальные взаимодействия',
        description: 'Мягкий, заботливый, ласковый стиль общения',
        intensity: 15,
        formula: {
          'Доверие': { change: 8, permanent: false },
          'Настроение': { change: 6, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'Унижение',
        category: 'Вербальные взаимодействия',
        description: 'Насмешливый, degrading, mocking стиль общения',
        intensity: 25,
        formula: {
          'Возбуждение': { change: 12, permanent: false },
          'Самооценка': { change: -8, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'Забота',
        category: 'Вербальные взаимодействия',
        description: 'Поддерживающий, encouraging, nurturing стиль общения',
        intensity: 18,
        formula: {
          'Самооценка': { change: 10, permanent: false },
          'Доверие': { change: 5, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'Насмешка',
        category: 'Вербальные взаимодействия',
        description: 'Саркастичный, ironic, teasing стиль общения',
        intensity: 22,
        formula: {
          'Возбуждение': { change: 8, permanent: false },
          'Смущение': { change: 3, permanent: false }
        },
        requirements: {}
      },

      // Простые действия
      {
        name: 'Погладить',
        category: 'Простые действия',
        description: 'Нежное прикосновение к телу',
        intensity: 10,
        formula: {
          'Чувствительность': { change: 0.2, permanent: false },
          'Настроение': { change: 5, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'Ударить',
        category: 'Простые действия',
        description: 'Физическое воздействие ударом',
        intensity: 30,
        formula: {
          'Боль': { change: 15, permanent: false },
          'Страх': { change: 8, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'Плеть',
        category: 'Простые действия',
        description: 'Использование плети для воздействия',
        intensity: 35,
        formula: {
          'Боль': { change: 20, permanent: false },
          'Мазохизм': { change: 0.3, permanent: false },
          'Страх': { change: 10, permanent: false }
        },
        requirements: {}
      },
      {
        name: 'Шокер',
        category: 'Простые действия',
        description: 'Электрическое воздействие шокером',
        intensity: 40,
        formula: {
          'Боль': { change: 25, permanent: false },
          'Страх': { change: 15, permanent: false },
          'Шок': { change: 20, permanent: false }
        },
        requirements: {}
      }
    ]

    // Создаем действия
    for (const action of actions) {
      await prisma.action.create({
        data: action
      })
    }

    console.log(`✅ Создано ${actions.length} действий`)

    // Создаем оборудование (устройства с позами)
    console.log('🏢 Создание оборудования...')

    const equipment = [
      // Базовые секс-машины
      {
        name: 'Многофункциональный вибрационный комплекс',
        category: 'Секс-машины',
        description: 'Квантовый вибрационный комплекс с нейронной синхронизацией для всесторонней стимуляции',
        rarity: 'COMMON',
        cost: 3000,
        requirements: {}
      },
      {
        name: 'Ротационный анальный стимулятор',
        category: 'Секс-машины',
        description: 'Автоматизированная ротационная платформа с адаптивными анальными модулями',
        rarity: 'UNCOMMON',
        cost: 4500,
        requirements: {}
      },
      {
        name: 'Циклический клиторальный модулятор',
        category: 'Секс-машины',
        description: 'Ротационный модулятор с нейронными клиторальными стимуляторами',
        rarity: 'COMMON',
        cost: 2800,
        requirements: {}
      },
      {
        name: 'Электромагнитная клетка',
        category: 'Секс-машины',
        description: 'Кондуктивная клетка с адаптивными электромагнитными импульсами',
        rarity: 'UNCOMMON',
        cost: 5500,
        requirements: {}
      },
      {
        name: 'Термодинамическая камера',
        category: 'Секс-машины',
        description: 'Изолированная термодинамическая камера с градиентными температурными полями',
        rarity: 'UNCOMMON',
        cost: 6200,
        requirements: {}
      },
      {
        name: 'Механическая тактильная клетка',
        category: 'Секс-машины',
        description: 'Автоматизированная клетка с сервомеханическими манипуляторами',
        rarity: 'COMMON',
        cost: 3800,
        requirements: {}
      },

      // Экстремальные секс-машины
      {
        name: 'Комбинированный сенсорный комплекс',
        category: 'Секс-машины',
        description: 'Интегрированный комплекс с многоуровневой сенсорной стимуляцией',
        rarity: 'RARE',
        cost: 8500,
        requirements: {}
      },
      {
        name: 'Тензионная рама',
        category: 'Секс-машины',
        description: 'Автоматизированная тензионная рама с адаптивной стимуляцией',
        rarity: 'RARE',
        cost: 7200,
        requirements: {}
      },
      {
        name: 'Групповой интерактивный комплекс',
        category: 'Секс-машины',
        description: 'Синхронизированная система взаимосвязанных модулей для групповых взаимодействий',
        rarity: 'EPIC',
        cost: 12000,
        requirements: {}
      },

      // Интерактивные сексуальные инструменты
      {
        name: 'Кибернетический партнер "Синтезатор"',
        category: 'Интерактивные сексуальные',
        description: 'Адаптивный кибернетический партнер с ИИ-анализом реакций',
        rarity: 'UNCOMMON',
        cost: 1800,
        requirements: {}
      },
      {
        name: 'Виртуальный гарем "Квантовый бордель"',
        category: 'Интерактивные сексуальные',
        description: 'Иммерсивная VR-система с бесконечным количеством виртуальных партнеров',
        rarity: 'RARE',
        cost: 2500,
        requirements: {}
      },
      {
        name: 'Сенсорный лабиринт "Лабиринт удовольствий"',
        category: 'Интерактивные сексуальные',
        description: 'Интерактивный лабиринт где стены и потолок оживают',
        rarity: 'EPIC',
        cost: 3200,
        requirements: {}
      },
      {
        name: 'Групповой симулятор "Синхронный узел"',
        category: 'Интерактивные сексуальные',
        description: 'Синхронизированная система где все участники чувствуют ощущения друг друга',
        rarity: 'RARE',
        cost: 2800,
        requirements: {}
      },
      {
        name: 'Адаптивный доминатор "Алгоритм власти"',
        category: 'Интерактивные сексуальные',
        description: 'ИИ-система анализирует реакции и автоматически переключается между доминированием и подчинением',
        rarity: 'EPIC',
        cost: 3500,
        requirements: {}
      },
      {
        name: 'Биомеханический симбионт "Симбиозатор"',
        category: 'Интерактивные сексуальные',
        description: 'Биомеханический организм который сливается с телом актива',
        rarity: 'LEGENDARY',
        cost: 4200,
        requirements: {}
      },

      // Глумливые инструменты
      {
        name: 'Гипнотический инъектор "Психо-модулятор"',
        category: 'Глумливые инструменты',
        description: 'Система гипноза с инъекциями психоактивных веществ для разрушения эмоциональной стабильности',
        rarity: 'RARE',
        cost: 3500,
        requirements: {}
      },
      {
        name: 'Когнитивный пресс "Мозговед"',
        category: 'Глумливые инструменты',
        description: 'Когнитивный тренажер где правильные ответы вознаграждаются оргазмом, а ошибки наказываются болью',
        rarity: 'EPIC',
        cost: 4200,
        requirements: {}
      },
      {
        name: 'Депрессантный инъектор "Надежда-убийца"',
        category: 'Глумливые инструменты',
        description: 'Система инъекций депрессантов с гипнотическим внушением для разрушения оптимизма',
        rarity: 'UNCOMMON',
        cost: 2800,
        requirements: {}
      },
      {
        name: 'Галлюциногенный симулятор "Безумие"',
        category: 'Глумливые инструменты',
        description: 'Галлюциногенный симулятор с инъекциями психоактивных веществ',
        rarity: 'RARE',
        cost: 3800,
        requirements: {}
      },
      {
        name: 'Оргия-симулятор "Плоть-машина"',
        category: 'Глумливые инструменты',
        description: 'Полный набор сексуальных взаимодействий от нежного до экстремального',
        rarity: 'LEGENDARY',
        cost: 5500,
        requirements: {}
      },
      {
        name: 'Аддиктивный инъектор "Цепи души"',
        category: 'Глумливые инструменты',
        description: 'Курс инъекций психоактивных веществ с формированием зависимости',
        rarity: 'RARE',
        cost: 3200,
        requirements: {}
      },
      {
        name: 'Надзирательская клетка "Хозяин пыток"',
        category: 'Глумливые инструменты',
        description: 'Актив наблюдает и управляет пытками других активов',
        rarity: 'EPIC',
        cost: 4800,
        requirements: {}
      },
      {
        name: 'Ломатель воли "Разрушитель"',
        category: 'Глумливые инструменты',
        description: 'Комбинированная система пыток где сопротивление только усиливает воздействие',
        rarity: 'EPIC',
        cost: 4500,
        requirements: {}
      }
    ]

    // Создаем оборудование
    for (const equip of equipment) {
      await prisma.equipment.create({
        data: equip
      })
    }

    console.log(`✅ Создано ${equipment.length} единиц оборудования`)

    console.log('🎉 Система действий и оборудования успешно исправлена!')
    console.log(`📊 Всего действий: ${actions.length}`)
    console.log(`📊 Всего оборудования: ${equipment.length}`)
    console.log(`📊 Категории действий: ${[...new Set(actions.map(a => a.category))].join(', ')}`)
    console.log(`📊 Категории оборудования: ${[...new Set(equipment.map(e => e.category))].join(', ')}`)

  } catch (error) {
    console.error('❌ Ошибка при исправлении действий и оборудования:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем скрипт
fixActionsAndEquipment()
  .then(() => {
    console.log('✅ Скрипт завершен успешно')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Ошибка выполнения скрипта:', error)
    process.exit(1)
  })
