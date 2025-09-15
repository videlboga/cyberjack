import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixCharacteristics() {
  console.log('🔧 Исправление системы характеристик...')

  try {
    // Удаляем все существующие определения характеристик
    console.log('🗑️ Удаление старых характеристик...')
    await prisma.characteristic.deleteMany()
    await prisma.characteristicDefinition.deleteMany()

    // Создаем новые определения характеристик согласно документации
    console.log('📝 Создание новых характеристик...')

    const characteristics = [
      // Физические характеристики
      {
        name: 'Выносливость',
        category: 'Физические',
        description: 'Способность выдерживать физические нагрузки и длительные эксперименты',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Чувствительность',
        category: 'Физические',
        description: 'Восприимчивость к физическим и эмоциональным воздействиям',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Гибкость',
        category: 'Физические',
        description: 'Физическая гибкость и способность принимать различные позы',
        minValue: 0,
        maxValue: 10
      },

      // Психологические характеристики
      {
        name: 'Эмоциональная стабильность',
        category: 'Психологические',
        description: 'Способность контролировать эмоции и сохранять психическое равновесие',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Адаптивность',
        category: 'Психологические',
        description: 'Способность приспосабливаться к новым условиям и ситуациям',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Интеллект',
        category: 'Психологические',
        description: 'Умственные способности и способность анализировать ситуацию',
        minValue: 0,
        maxValue: 10
      },

      // Социальные характеристики
      {
        name: 'Общительность',
        category: 'Социальные',
        description: 'Способность и желание общаться с другими людьми',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Эмпатия',
        category: 'Социальные',
        description: 'Способность понимать и чувствовать эмоции других людей',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Доминантность',
        category: 'Социальные',
        description: 'Стремление к лидерству и контролю над ситуацией',
        minValue: 0,
        maxValue: 10
      },

      // Личностные характеристики
      {
        name: 'Самооценка',
        category: 'Личностные',
        description: 'Восприятие собственной ценности и достоинства',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Оптимизм',
        category: 'Личностные',
        description: 'Вера в лучшее будущее и положительный взгляд на жизнь',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Любопытство',
        category: 'Личностные',
        description: 'Стремление к новым знаниям и опыту',
        minValue: 0,
        maxValue: 10
      },

      // Специальные характеристики
      {
        name: 'Сексуальная опытность',
        category: 'Специальные',
        description: 'Опыт в интимных отношениях и сексуальных практиках',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Сопротивляемость',
        category: 'Специальные',
        description: 'Способность сопротивляться принуждению и манипуляциям',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Зависимость',
        category: 'Специальные',
        description: 'Склонность к формированию эмоциональных и физических зависимостей',
        minValue: 0,
        maxValue: 10
      },

      // Состояния (добавляем как характеристики)
      {
        name: 'Усталость',
        category: 'Состояния',
        description: 'Уровень физической и психической усталости',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Страх',
        category: 'Состояния',
        description: 'Уровень страха и тревожности',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Возбуждение',
        category: 'Состояния',
        description: 'Уровень сексуального возбуждения',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Боль',
        category: 'Состояния',
        description: 'Уровень испытываемой боли',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Унижение',
        category: 'Состояния',
        description: 'Уровень чувства унижения',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Стыд',
        category: 'Состояния',
        description: 'Уровень чувства стыда',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Отчаяние',
        category: 'Состояния',
        description: 'Уровень отчаяния и безнадежности',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Гордость',
        category: 'Состояния',
        description: 'Уровень гордости и самоуважения',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Невинность',
        category: 'Состояния',
        description: 'Уровень невинности и чистоты',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Покорность',
        category: 'Состояния',
        description: 'Уровень покорности и подчинения',
        minValue: 0,
        maxValue: 10
      },

      // Фетиши (добавляем как характеристики)
      {
        name: 'Доминирование',
        category: 'Фетиши',
        description: 'Стремление контролировать и доминировать над партнёром',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Подчинение',
        category: 'Фетиши',
        description: 'Желание подчиняться и быть контролируемой',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Садизм',
        category: 'Фетиши',
        description: 'Получение удовольствия от причинения боли или дискомфорта',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Мазохизм',
        category: 'Фетиши',
        description: 'Получение удовольствия от боли и страдания',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Унижение',
        category: 'Фетиши',
        description: 'Получение удовольствия от унижения и оскорблений',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Власть',
        category: 'Фетиши',
        description: 'Стремление к власти и контролю',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Зависимость',
        category: 'Фетиши',
        description: 'Желание быть зависимой от партнёра',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Собственность',
        category: 'Фетиши',
        description: 'Желание принадлежать партнёру',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Сенсорная депривация',
        category: 'Фетиши',
        description: 'Лишение чувств (зрение, слух, осязание)',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Сенсорная перегрузка',
        category: 'Фетиши',
        description: 'Избыточная стимуляция чувств',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Щекотка',
        category: 'Фетиши',
        description: 'Получение удовольствия от щекотки',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Вибрации',
        category: 'Фетиши',
        description: 'Использование вибрационных устройств',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Фут-фетиш',
        category: 'Фетиши',
        description: 'Фетиш на ноги и ступни',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Хенд-фетиш',
        category: 'Фетиши',
        description: 'Фетиш на руки',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Брест-фетиш',
        category: 'Фетиши',
        description: 'Фетиш на грудь',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Анал-фетиш',
        category: 'Фетиши',
        description: 'Фетиш на анальную область',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Латекс/кожа',
        category: 'Фетиши',
        description: 'Фетиш на латексную или кожаную одежду',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Шёлк/атлас',
        category: 'Фетиши',
        description: 'Фетиш на шёлковые и атласные ткани',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Резинки/верёвки',
        category: 'Фетиши',
        description: 'Фетиш на ограничения и связывание',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Страх',
        category: 'Фетиши',
        description: 'Получение удовольствия от страха',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Стыд',
        category: 'Фетиши',
        description: 'Получение удовольствия от стыда',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Вина',
        category: 'Фетиши',
        description: 'Получение удовольствия от чувства вины',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Запретное',
        category: 'Фетиши',
        description: 'Влечение к запретному и табу',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Беременность',
        category: 'Фетиши',
        description: 'Фетиш на беременность и материнство',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Лактация',
        category: 'Фетиши',
        description: 'Фетиш на грудное вскармливание',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Менструация',
        category: 'Фетиши',
        description: 'Фетиш на менструальный цикл',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Униформа',
        category: 'Фетиши',
        description: 'Фетиш на униформу и профессиональную одежду',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Статус',
        category: 'Фетиши',
        description: 'Фетиш на социальный статус и иерархию',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Возраст',
        category: 'Фетиши',
        description: 'Фетиш на возрастные различия',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Водыпорт',
        category: 'Фетиши',
        description: 'Фетиш на водные виды спорта',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Эдж-плей',
        category: 'Фетиши',
        description: 'Игра на грани оргазма',
        minValue: 0,
        maxValue: 10
      },
      {
        name: 'Ограничение дыхания',
        category: 'Фетиши',
        description: 'Фетиш на ограничение дыхания',
        minValue: 0,
        maxValue: 10
      }
    ]

    // Создаем определения характеристик
    for (const char of characteristics) {
      await prisma.characteristicDefinition.create({
        data: char
      })
    }

    console.log(`✅ Создано ${characteristics.length} определений характеристик`)

    // Создаем характеристики для всех существующих персонажей
    console.log('👥 Создание характеристик для персонажей...')

    const characters = await prisma.character.findMany()
    const charDefinitions = await prisma.characteristicDefinition.findMany()

    for (const character of characters) {
      for (const def of charDefinitions) {
        // Генерируем случайные базовые значения (3-7 для большинства характеристик)
        let baseValue = Math.random() * 4 + 3 // 3-7

        // Специальные значения для некоторых характеристик
        if (def.category === 'Состояния') {
          baseValue = Math.random() * 2 + 1 // 1-3 для состояний
        } else if (def.category === 'Фетиши') {
          baseValue = Math.random() * 3 + 1 // 1-4 для фетишей
        } else if (def.name === 'Сексуальная опытность') {
          baseValue = Math.random() * 2 + 1 // 1-3 для невинности
        }

        await prisma.characteristic.create({
          data: {
            characterId: character.id,
            characteristicDefId: def.id,
            currentValue: baseValue,
            baseValue: baseValue,
            recoveryRate: 0.1, // Медленное восстановление
            shiftThreshold: 60, // 60 минут для сдвига базы
            shiftRate: 0.05, // Медленный сдвиг базы
            timeInAlteredState: 0
          }
        })
      }
    }

    console.log(`✅ Созданы характеристики для ${characters.length} персонажей`)

    console.log('🎉 Система характеристик успешно исправлена!')
    console.log(`📊 Всего характеристик: ${characteristics.length}`)
    console.log(`📊 Категории: ${[...new Set(characteristics.map(c => c.category))].join(', ')}`)

  } catch (error) {
    console.error('❌ Ошибка при исправлении характеристик:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем скрипт
fixCharacteristics()
  .then(() => {
    console.log('✅ Скрипт завершен успешно')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Ошибка выполнения скрипта:', error)
    process.exit(1)
  })
