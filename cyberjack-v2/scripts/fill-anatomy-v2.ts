import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fillAnatomy() {
  console.log('🔧 Наполнение системы анатомии...')

  try {
    // Удаляем все существующие определения анатомии
    console.log('🗑️ Удаление старых определений анатомии...')
    await prisma.characterAnatomy.deleteMany()
    await prisma.anatomyDefinition.deleteMany()

    // Создаем новые определения анатомии
    console.log('📝 Создание новых определений анатомии...')

    const anatomyParts = [
      // Голова и лицо
      {
        name: 'Голова',
        category: 'Голова и лицо',
        description: 'Вся голова целиком'
      },
      {
        name: 'Лицо',
        category: 'Голова и лицо',
        description: 'Лицевая часть головы'
      },
      {
        name: 'Лоб',
        category: 'Голова и лицо',
        description: 'Верхняя часть лица'
      },
      {
        name: 'Глаза',
        category: 'Голова и лицо',
        description: 'Органы зрения'
      },
      {
        name: 'Нос',
        category: 'Голова и лицо',
        description: 'Орган обоняния'
      },
      {
        name: 'Щеки',
        category: 'Голова и лицо',
        description: 'Боковые части лица'
      },
      {
        name: 'Губы',
        category: 'Голова и лицо',
        description: 'Мягкие ткани вокруг рта'
      },
      {
        name: 'Рот',
        category: 'Голова и лицо',
        description: 'Ротовая полость'
      },
      {
        name: 'Язык',
        category: 'Голова и лицо',
        description: 'Мышечный орган в ротовой полости'
      },
      {
        name: 'Зубы',
        category: 'Голова и лицо',
        description: 'Костные образования в челюстях'
      },
      {
        name: 'Подбородок',
        category: 'Голова и лицо',
        description: 'Нижняя часть лица'
      },
      {
        name: 'Уши',
        category: 'Голова и лицо',
        description: 'Органы слуха'
      },
      {
        name: 'Шея',
        category: 'Голова и лицо',
        description: 'Часть тела между головой и туловищем'
      },

      // Верхняя часть тела
      {
        name: 'Плечи',
        category: 'Верхняя часть тела',
        description: 'Верхняя часть рук, соединенная с туловищем'
      },
      {
        name: 'Руки',
        category: 'Верхняя часть тела',
        description: 'Верхние конечности'
      },
      {
        name: 'Предплечья',
        category: 'Верхняя часть тела',
        description: 'Часть руки между локтем и запястьем'
      },
      {
        name: 'Локти',
        category: 'Верхняя часть тела',
        description: 'Сустав между плечом и предплечьем'
      },
      {
        name: 'Запястья',
        category: 'Верхняя часть тела',
        description: 'Сустав между предплечьем и кистью'
      },
      {
        name: 'Кисти',
        category: 'Верхняя часть тела',
        description: 'Конечная часть рук'
      },
      {
        name: 'Пальцы рук',
        category: 'Верхняя часть тела',
        description: 'Пальцы на руках'
      },
      {
        name: 'Ладони',
        category: 'Верхняя часть тела',
        description: 'Внутренняя сторона кистей'
      },
      {
        name: 'Тыльная сторона рук',
        category: 'Верхняя часть тела',
        description: 'Внешняя сторона рук'
      },

      // Туловище
      {
        name: 'Грудь',
        category: 'Туловище',
        description: 'Передняя часть туловища'
      },
      {
        name: 'Спина',
        category: 'Туловище',
        description: 'Задняя часть туловища'
      },
      {
        name: 'Бока',
        category: 'Туловище',
        description: 'Боковые части туловища'
      },
      {
        name: 'Живот',
        category: 'Туловище',
        description: 'Передняя часть туловища ниже груди'
      },
      {
        name: 'Поясница',
        category: 'Туловище',
        description: 'Нижняя часть спины'
      },
      {
        name: 'Бедра',
        category: 'Туловище',
        description: 'Верхняя часть ног'
      },
      {
        name: 'Талия',
        category: 'Туловище',
        description: 'Самая узкая часть туловища'
      },

      // Женская грудь
      {
        name: 'Молочные железы',
        category: 'Женская грудь',
        description: 'Женские молочные железы'
      },
      {
        name: 'Соски',
        category: 'Женская грудь',
        description: 'Центральная часть молочных желез'
      },
      {
        name: 'Ареолы',
        category: 'Женская грудь',
        description: 'Пигментированная область вокруг сосков'
      },

      // Половые органы (женские)
      {
        name: 'Вульва',
        category: 'Половые органы (женские)',
        description: 'Наружные женские половые органы'
      },
      {
        name: 'Клитор',
        category: 'Половые органы (женские)',
        description: 'Чувствительный орган в верхней части вульвы'
      },
      {
        name: 'Большие половые губы',
        category: 'Половые органы (женские)',
        description: 'Внешние складки вульвы'
      },
      {
        name: 'Малые половые губы',
        category: 'Половые органы (женские)',
        description: 'Внутренние складки вульвы'
      },
      {
        name: 'Вход во влагалище',
        category: 'Половые органы (женские)',
        description: 'Отверстие влагалища'
      },
      {
        name: 'Влагалище',
        category: 'Половые органы (женские)',
        description: 'Внутренний половой орган'
      },
      {
        name: 'Матка',
        category: 'Половые органы (женские)',
        description: 'Внутренний репродуктивный орган'
      },
      {
        name: 'Шейка матки',
        category: 'Половые органы (женские)',
        description: 'Нижняя часть матки'
      },

      // Половые органы (мужские)
      {
        name: 'Пенис',
        category: 'Половые органы (мужские)',
        description: 'Мужской половой орган'
      },
      {
        name: 'Головка пениса',
        category: 'Половые органы (мужские)',
        description: 'Верхняя часть пениса'
      },
      {
        name: 'Ствол пениса',
        category: 'Половые органы (мужские)',
        description: 'Основная часть пениса'
      },
      {
        name: 'Яички',
        category: 'Половые органы (мужские)',
        description: 'Мужские половые железы'
      },
      {
        name: 'Мошонка',
        category: 'Половые органы (мужские)',
        description: 'Кожный мешочек с яичками'
      },

      // Анальная область
      {
        name: 'Анус',
        category: 'Анальная область',
        description: 'Заднепроходное отверстие'
      },
      {
        name: 'Перианальная область',
        category: 'Анальная область',
        description: 'Область вокруг ануса'
      },
      {
        name: 'Прямая кишка',
        category: 'Анальная область',
        description: 'Конечная часть толстой кишки'
      },

      // Нижняя часть тела
      {
        name: 'Ноги',
        category: 'Нижняя часть тела',
        description: 'Нижние конечности'
      },
      {
        name: 'Бедра',
        category: 'Нижняя часть тела',
        description: 'Верхняя часть ног'
      },
      {
        name: 'Колени',
        category: 'Нижняя часть тела',
        description: 'Сустав между бедром и голенью'
      },
      {
        name: 'Голени',
        category: 'Нижняя часть тела',
        description: 'Часть ноги между коленом и стопой'
      },
      {
        name: 'Икры',
        category: 'Нижняя часть тела',
        description: 'Задняя часть голени'
      },
      {
        name: 'Лодыжки',
        category: 'Нижняя часть тела',
        description: 'Сустав между голенью и стопой'
      },
      {
        name: 'Стопы',
        category: 'Нижняя часть тела',
        description: 'Конечная часть ног'
      },
      {
        name: 'Пальцы ног',
        category: 'Нижняя часть тела',
        description: 'Пальцы на ногах'
      },
      {
        name: 'Подошвы',
        category: 'Нижняя часть тела',
        description: 'Нижняя сторона стоп'
      },
      {
        name: 'Тыльная сторона стоп',
        category: 'Нижняя часть тела',
        description: 'Верхняя сторона стоп'
      },

      // Дополнительные зоны
      {
        name: 'Подмышки',
        category: 'Дополнительные зоны',
        description: 'Область под плечами'
      },
      {
        name: 'Пах',
        category: 'Дополнительные зоны',
        description: 'Область между ногами и туловищем'
      },
      {
        name: 'Внутренняя сторона бедер',
        category: 'Дополнительные зоны',
        description: 'Внутренняя поверхность бедер'
      },
      {
        name: 'Внешняя сторона бедер',
        category: 'Дополнительные зоны',
        description: 'Внешняя поверхность бедер'
      },
      {
        name: 'Ягодицы',
        category: 'Дополнительные зоны',
        description: 'Задняя часть туловища'
      },
      {
        name: 'Копчик',
        category: 'Дополнительные зоны',
        description: 'Нижняя часть позвоночника'
      },
      {
        name: 'Позвоночник',
        category: 'Дополнительные зоны',
        description: 'Осевой скелет спины'
      },
      {
        name: 'Ребра',
        category: 'Дополнительные зоны',
        description: 'Костные дуги грудной клетки'
      },
      {
        name: 'Ключицы',
        category: 'Дополнительные зоны',
        description: 'Кости между плечами и грудиной'
      },
      {
        name: 'Лопатки',
        category: 'Дополнительные зоны',
        description: 'Кости на задней части плеч'
      }
    ]

    // Создаем определения анатомии
    for (const part of anatomyParts) {
      await prisma.anatomyDefinition.create({
        data: part
      })
    }

    console.log(`✅ Создано ${anatomyParts.length} определений анатомии`)

    // Создаем анатомию для всех существующих персонажей
    console.log('👥 Создание анатомии для персонажей...')

    const characters = await prisma.character.findMany()
    const anatomyDefinitions = await prisma.anatomyDefinition.findMany()

    for (const character of characters) {
      for (const def of anatomyDefinitions) {
        // Определяем, есть ли у персонажа эта часть тела
        let hasPart = true

        // Мужские персонажи не имеют женских половых органов
        if (def.category === 'Половые органы (женские)' && character.name.includes('Мужчина')) {
          hasPart = false
        }

        // Женские персонажи не имеют мужских половых органов
        if (def.category === 'Половые органы (мужские)' && !character.name.includes('Мужчина')) {
          hasPart = false
        }

        // Генерируем случайную чувствительность (20-80)
        const sensitivity = Math.random() * 60 + 20

        await prisma.characterAnatomy.create({
          data: {
            characterId: character.id,
            anatomyDefId: def.id,
            hasPart: hasPart,
            sensitivity: sensitivity
          }
        })
      }
    }

    console.log(`✅ Создана анатомия для ${characters.length} персонажей`)

    console.log('🎉 Система анатомии успешно наполнена!')
    console.log(`📊 Всего частей тела: ${anatomyParts.length}`)
    console.log(`📊 Категории: ${[...new Set(anatomyParts.map(p => p.category))].join(', ')}`)

  } catch (error) {
    console.error('❌ Ошибка при наполнении анатомии:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем скрипт
fillAnatomy()
  .then(() => {
    console.log('✅ Скрипт завершен успешно')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Ошибка выполнения скрипта:', error)
    process.exit(1)
  })
