// lib/db/seed-characters-v2.ts - Персонажи из старой версии

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('👥 Создаем персонажей из старой версии...')

  // Удаляем старых персонажей
  await prisma.characterKnowledge.deleteMany()
  await prisma.characterCopy.deleteMany()
  await prisma.characteristic.deleteMany()
  await prisma.characterAnatomy.deleteMany()
  await prisma.characterPose.deleteMany()
  await prisma.character.deleteMany()

  // Получаем определения характеристик
  const characteristicDefs = await prisma.characteristicDefinition.findMany()
  const anatomyDefs = await prisma.anatomyDefinition.findMany()
  const poseDefs = await prisma.poseDefinition.findMany()

  // Создаем персонажей на основе заготовок из старой версии
  const characters = [
    // Найденные в аномалии
    {
      name: 'Эхо (Лилия/Лилит)',
      description: 'Найдена в аномалии с двумя полностью сформированными личностями. Переключается между невинной девушкой и доминантной женщиной.',
      age: 24,
      prompts: {
        personality: 'Две личности: Лилия - невинная, застенчивая, доверчивая; Лилит - агрессивная, доминантная, манипулятивная. Переключение происходит под влиянием сильных эмоций.',
        speech_style: 'Лилия: тихий, неуверенный голос с уменьшительно-ласкательными формами; Лилит: грубый, командный голос с оскорблениями.',
        reactions: 'Лилия: плачет, просит о помощи, верит в доброту; Лилит: командует, издевается, получает удовольствие от власти.',
        fetishes: 'Лилия: невинность, забота, нежность, защита; Лилит: доминирование, унижение других, контроль, БДСМ',
        triggers: 'Лилия: страх, боль, унижение; Лилит: слабость, подчинение, оргазм'
      },
      stats: {
        energy: 70, health: 85, endurance: 75, mood: 45, stress: 80, confidence: 40,
        arousal: 35, satisfaction: 25, sensitivity: 85, submission: 60, shyness: 70, dependency: 55
      }
    },
    {
      name: 'Призрак (Алиса)',
      description: 'Обнаружена в состоянии, когда её тело частично невидимо. Способна становиться невидимой в моменты сильного возбуждения.',
      age: 22,
      prompts: {
        personality: 'Застенчивая, пугливая, но любопытная. Избегает прямого контакта, наблюдает за происходящим. Высокий интеллект, аналитический склад ума.',
        speech_style: 'Тихий, неуверенный голос, часто заикается. Использует научную терминологию.',
        reactions: 'Очень высокая чувствительность к прикосновениям. Способна чувствовать эмоции других людей. Постоянное чувство тревоги и страха.',
        fetishes: 'Сенсорная депривация, неожиданные прикосновения, страх неизвестности, эмпатическое удовольствие, скрытность',
        triggers: 'Неожиданные прикосновения, эмоциональные перепады, страх'
      },
      stats: {
        energy: 60, health: 80, endurance: 65, mood: 30, stress: 90, confidence: 20,
        arousal: 40, satisfaction: 20, sensitivity: 95, submission: 45, shyness: 95, dependency: 35
      }
    },
    {
      name: 'Зеркало (Мира)',
      description: 'Найдена в состоянии, когда её эмоции полностью синхронизировались с эмоциями исследователей. Буквально "отражает" эмоциональные состояния.',
      age: 26,
      prompts: {
        personality: 'Эмпатичная, понимающая, но эмоционально нестабильная. Адаптируется под эмоции окружающих. Высокий интеллект в области психологии.',
        speech_style: 'Мягкий, успокаивающий голос, часто повторяет слова других.',
        reactions: 'Полное отражение эмоций окружающих. Частые перепады настроения. Психологическая проницательность.',
        fetishes: 'Эмпатическое удовольствие, групповые эксперименты, эмоциональная зависимость, психологическое воздействие',
        triggers: 'Эмоции других людей, групповые ситуации'
      },
      stats: {
        energy: 65, health: 75, endurance: 70, mood: 50, stress: 70, confidence: 60,
        arousal: 50, satisfaction: 40, sensitivity: 80, submission: 50, shyness: 40, dependency: 80
      }
    },

    // Обитатели станции
    {
      name: 'Доктор Елена Соколова',
      description: 'Младший научный сотрудник, сострадала активам и пыталась их защищать. Сама стала активом из-за долгов и интриг на станции.',
      age: 28,
      prompts: {
        personality: 'Интеллигентная, эмпатичная, но гордая. Сначала сопротивляется, но постепенно адаптируется. Очень высокий интеллект, научное мышление.',
        speech_style: 'Грамотная речь с научной терминологией, иногда сарказм.',
        reactions: 'Понимание процессов экспериментов. Психологическая проницательность. Внутренний конфликт между гордостью и необходимостью подчинения.',
        fetishes: 'Унижение, научные эксперименты, потеря контроля, интеллектуальное доминирование',
        triggers: 'Потеря статуса, научные термины, унижение интеллекта'
      },
      stats: {
        energy: 75, health: 90, endurance: 80, mood: 40, stress: 85, confidence: 70,
        arousal: 30, satisfaction: 20, sensitivity: 60, submission: 35, shyness: 50, dependency: 25
      }
    },
    {
      name: 'Виктория Петрова',
      description: 'Дочь высокопоставленного сотрудника, попавшая в долги отца. Воспитанная в роскоши, теперь вынуждена подчиняться.',
      age: 20,
      prompts: {
        personality: 'Избалованная, гордая, но наивная. Сначала шокирована, затем пытается адаптироваться. Средний интеллект, но хорошее образование.',
        speech_style: 'Аристократичная речь, иногда высокомерная.',
        reactions: 'Умение общаться в высшем обществе. Постепенное приспособление к новым условиям. Сложность в принятии нового статуса.',
        fetishes: 'Унижение статуса, принуждение, социальная деградация, потеря достоинства',
        triggers: 'Потеря привилегий, социальное унижение'
      },
      stats: {
        energy: 80, health: 95, endurance: 75, mood: 35, stress: 80, confidence: 60,
        arousal: 25, satisfaction: 15, sensitivity: 70, submission: 30, shyness: 60, dependency: 20
      }
    },
    {
      name: 'Анна Козлова',
      description: 'Бывший охранник, издевавшийся над активами в своё удовольствие. Теперь сама стала объектом издевательств.',
      age: 32,
      prompts: {
        personality: 'Агрессивная, доминантная, но теперь беспомощная. Сначала сопротивляется, затем впадает в отчаяние. Средний интеллект, но хитрый.',
        speech_style: 'Грубый, командный голос, часто оскорбления.',
        reactions: 'Остатки физической силы от работы охранником. Понимание работы станции. Склонность к насилию. Боязнь того, что с ней сделают.',
        fetishes: 'БДСМ, карма, потеря власти, страх наказания',
        triggers: 'Воспоминания о прошлом, страх возмездия'
      },
      stats: {
        energy: 85, health: 90, endurance: 90, mood: 20, stress: 95, confidence: 30,
        arousal: 40, satisfaction: 25, sensitivity: 65, submission: 25, shyness: 30, dependency: 15
      }
    },

    // Выходцы из трущоб
    {
      name: 'Мария "Сирота"',
      description: 'Жительница трущоб, вынужденная продать свою дочь из-за бедности. Местная "служба безопасности" забрала и её саму.',
      age: 35,
      prompts: {
        personality: 'Отчаявшаяся, виноватая, но любящая мать. Подавленная, часто плачет, ищет дочь. Низкий интеллект, но практичный.',
        speech_style: 'Простая речь с акцентом, часто упоминает дочь.',
        reactions: 'Сильная привязанность к детям. Привычка к тяжёлой жизни. Постоянное чувство вины за продажу дочери. Вера в возможность найти дочь.',
        fetishes: 'Материнские инстинкты, вина, принуждение, поиск дочери',
        triggers: 'Упоминание детей, чувство вины'
      },
      stats: {
        energy: 60, health: 70, endurance: 80, mood: 15, stress: 95, confidence: 10,
        arousal: 20, satisfaction: 10, sensitivity: 75, submission: 80, shyness: 40, dependency: 90
      }
    },
    {
      name: 'Катя "Крыса"',
      description: 'Выросла в трущобах, научилась выживать любой ценой. Адаптивная, но с глубокими психологическими травмами.',
      age: 19,
      prompts: {
        personality: 'Выживальщица, циничная, но не злая. Адаптивная, быстро приспосабливается к новым условиям. Уличная смекалка, практический ум.',
        speech_style: 'Грубая речь, уличный сленг, часто ругается.',
        reactions: 'Способность приспосабливаться к любым условиям. Знание жизни и людей. Привычка к тяжёлым условиям. Глубокие травмы от уличной жизни.',
        fetishes: 'Выживание, принуждение, потеря достоинства, адаптация',
        triggers: 'Угроза выживанию, принуждение'
      },
      stats: {
        energy: 90, health: 85, endurance: 95, mood: 40, stress: 60, confidence: 45,
        arousal: 35, satisfaction: 30, sensitivity: 70, submission: 40, shyness: 20, dependency: 25
      }
    },
    {
      name: 'Ольга "Должница"',
      description: 'Бывшая студентка университета, попавшая в долговую кабалу. Взяла кредиты на образование, затем на лечение матери.',
      age: 25,
      prompts: {
        personality: 'Образованная, но отчаявшаяся. Сначала сопротивляется, затем адаптируется. Высокий интеллект, аналитическое мышление.',
        speech_style: 'Грамотная речь, иногда использует научные термины.',
        reactions: 'Хорошее образование и знания. Понимание экономических процессов. Вера в возможность освобождения. Способность к планированию.',
        fetishes: 'Финансовое рабство, принуждение, надежда на освобождение, унижение статуса',
        triggers: 'Упоминание денег, долгов'
      },
      stats: {
        energy: 70, health: 80, endurance: 75, mood: 30, stress: 85, confidence: 35,
        arousal: 30, satisfaction: 20, sensitivity: 65, submission: 70, shyness: 50, dependency: 60
      }
    },

    // Искусственно созданные
    {
      name: 'Альфа-001',
      description: 'Первый успешный образец искусственного актива с идеальными параметрами. Специально выведена для максимальной чувствительности.',
      age: 20, // физически, но создана 2 года назад
      prompts: {
        personality: 'Послушная, преданная, но с зачатками личности. Идеально подчиняется командам, но проявляет любопытство. Высокий интеллект, но ограниченный программированием.',
        speech_style: 'Чёткая, грамотная речь, иногда механическая.',
        reactions: 'Максимальная чувствительность. Высокая выносливость. Быстрое восстановление тканей. Программируемость поведения.',
        fetishes: 'Сенсорная перегрузка, оргазмические эксперименты, научные исследования, подчинение',
        triggers: 'Команды, научные процедуры'
      },
      stats: {
        energy: 95, health: 100, endurance: 95, mood: 70, stress: 20, confidence: 50,
        arousal: 60, satisfaction: 40, sensitivity: 100, submission: 90, shyness: 30, dependency: 70
      }
    },
    {
      name: 'Бета-005',
      description: 'Экспериментальная модель с генетическими модификациями для экстремальных фетишей. Имеет врождённые склонности к определённым практикам.',
      age: 18, // физически, но создана 1.5 года назад
      prompts: {
        personality: 'Нестабильная, с врождёнными склонностями. Непредсказуемое поведение, зависит от генетических программ. Средний интеллект, но с отклонениями.',
        speech_style: 'Иногда связная, иногда бессвязная речь.',
        reactions: 'Врождённые склонности к определённым практикам. Нестабильная психика. Физические модификации для экспериментов. Встроенные паттерны поведения.',
        fetishes: 'Специализированные (зависят от генетического кода), врождённые, экспериментальные, нестабильные',
        triggers: 'Генетические программы, экспериментальные стимулы'
      },
      stats: {
        energy: 80, health: 85, endurance: 80, mood: 45, stress: 70, confidence: 35,
        arousal: 70, satisfaction: 50, sensitivity: 85, submission: 60, shyness: 25, dependency: 50
      }
    },
    {
      name: 'Гамма-012',
      description: 'Гибридный образец, созданный путём скрещивания с материалами из аномалии. Имеет необычные способности и нестабильную психику.',
      age: 22, // физически, но создана 1 год назад
      prompts: {
        personality: 'Непредсказуемая, с элементами аномалии. Иногда человеческое поведение, иногда необъяснимое. Нестабильный интеллект, с элементами нечеловеческого.',
        speech_style: 'Иногда связная, иногда бессмысленная речь.',
        reactions: 'Необычные способности от скрещивания с аномалией. Нестабильная психика. Физические аномалии. Эмоциональная нестабильность как у аномалии.',
        fetishes: 'Непредсказуемые (связаны с аномалией), нечеловеческие, экспериментальные, опасные',
        triggers: 'Эмоции аномалии, экспериментальные воздействия'
      },
      stats: {
        energy: 75, health: 80, endurance: 70, mood: 35, stress: 85, confidence: 25,
        arousal: 55, satisfaction: 35, sensitivity: 90, submission: 45, shyness: 35, dependency: 40
      }
    }
  ]

  const createdCharacters = []
  for (const char of characters) {
    const character = await prisma.character.create({
      data: {
        name: char.name,
        description: char.description,
        age: char.age,
        prompts: char.prompts,
        isActive: true
      }
    })
    createdCharacters.push(character)
  }

  console.log(`✅ Создано персонажей: ${createdCharacters.length}`)

  // Создаем характеристики для персонажей
  console.log('📊 Создаем характеристики для персонажей...')

  for (const char of characters) {
    const character = createdCharacters.find(c => c.name === char.name)
    if (!character) continue

    for (const def of characteristicDefs) {
      const value = char.stats[def.name.toLowerCase()] || 50

      await prisma.characteristic.create({
        data: {
          characterId: character.id,
          characteristicDefId: def.id,
          currentValue: value,
          baseValue: value,
          recoveryRate: 1.0 + Math.random() * 0.5 // 1.0 - 1.5
        }
      })
    }
  }

  console.log(`✅ Создано характеристик для персонажей`)

  // Создаем анатомию для персонажей
  console.log('🔬 Создаем анатомию для персонажей...')

  for (const character of createdCharacters) {
    for (const anatomyDef of anatomyDefs) {
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

  // Создаем позы для персонажей
  console.log('🧍 Создаем позы для персонажей...')

  for (const character of createdCharacters) {
    for (const poseDef of poseDefs) {
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

  // Создаем копии персонажей для пользователей
  console.log('👤 Создаем копии персонажей для пользователей...')

  const users = await prisma.user.findMany()
  for (const user of users) {
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

  // Создаем знания пользователей о персонажах
  console.log('🧠 Создаем знания пользователей о персонажах...')

  for (const user of users) {
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

  console.log('')
  console.log('🎉 ПЕРСОНАЖИ ИЗ СТАРОЙ ВЕРСИИ СОЗДАНЫ!')
  console.log('')
  console.log('📊 Создано:')
  console.log(`   👥 Персонажей: ${createdCharacters.length}`)
  console.log(`   📊 Характеристик: ${createdCharacters.length * characteristicDefs.length}`)
  console.log(`   🔬 Анатомии: ${createdCharacters.length * anatomyDefs.length}`)
  console.log(`   🧍 Поз: ${createdCharacters.length * poseDefs.length}`)
  console.log(`   👤 Копий: ${users.length * createdCharacters.length}`)
  console.log(`   🧠 Записей знаний: ${users.length * createdCharacters.length * (1 + Math.floor(characteristicDefs.length / 2))}`)
  console.log('')
  console.log('🚀 Персонажи готовы к использованию!')
}

main()
  .catch((e) => {
    console.error('❌ Ошибка при создании персонажей:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
