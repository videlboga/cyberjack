import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupCharacters() {
  console.log('🔧 Очистка и создание персонажей...')

  try {
    // Удаляем всех существующих персонажей (каскадно удалятся все связанные данные)
    console.log('🗑️ Удаление всех существующих персонажей...')
    await prisma.character.deleteMany()

    // Создаем новых персонажей
    console.log('👥 Создание новых персонажей...')

    const characters = [
      {
        name: 'Анечка',
        description: 'Невинная девушка-подросток, доверчивая и подчиняющаяся. Очень чувствительная к любым воздействиям.',
        age: 16,
        avatar: null,
        prompts: {
          personality: 'Невинная, доверчивая, подчиняющаяся, очень чувствительная',
          speech_style: 'Мягкий, детский голос, часто говорит "пожалуйста" и "извините"',
          reactions: 'Легко краснеет, плачет от боли, но старается быть послушной',
          background: 'Обычная школьница, попала в эксперимент случайно'
        }
      },
      {
        name: 'Кай',
        description: 'Женственный художник, фембой с мягким характером. Творческая натура с чувствительной душой.',
        age: 18,
        avatar: null,
        prompts: {
          personality: 'Женственный, творческий, чувствительный, мягкий характер',
          speech_style: 'Мягкий, почти женственный голос, использует художественные метафоры',
          reactions: 'Эмоционально реагирует, выражает чувства через искусство',
          background: 'Художник, изучает искусство, попал в эксперимент для вдохновения'
        }
      },
      {
        name: 'Линь Сюэжань',
        description: 'Девушка-исследователь, которая намеренно перешла в категорию испытуемых для лучшего понимания изучения аномалии. Доминантная, критикует игрока.',
        age: 24,
        avatar: null,
        prompts: {
          personality: 'Доминантная, умная, критичная, исследователь',
          speech_style: 'Резкий, научный тон, часто критикует и анализирует',
          reactions: 'Сопротивляется, анализирует ситуацию, пытается контролировать',
          background: 'Ученый-исследователь, добровольно участвует в эксперименте'
        }
      }
    ]

    // Создаем персонажей
    for (const char of characters) {
      await prisma.character.create({
        data: char
      })
    }

    console.log(`✅ Создано ${characters.length} персонажей`)

    // Получаем созданных персонажей и определения характеристик
    const createdCharacters = await prisma.character.findMany()
    const charDefinitions = await prisma.characteristicDefinition.findMany()
    const anatomyDefinitions = await prisma.anatomyDefinition.findMany()
    const poseDefinitions = await prisma.poseDefinition.findMany()

    // Создаем характеристики для каждого персонажа
    console.log('📊 Создание характеристик для персонажей...')

    for (const character of createdCharacters) {
      for (const def of charDefinitions) {
        let baseValue = Math.random() * 4 + 3 // 3-7 по умолчанию

        // Специальные значения для разных персонажей
        if (character.name === 'Анечка') {
          // Невинная, доверчивая, подчиняющаяся, очень чувствительная
          if (def.name === 'Невинность') baseValue = 9
          if (def.name === 'Покорность') baseValue = 8
          if (def.name === 'Чувствительность') baseValue = 9
          if (def.name === 'Доверие') baseValue = 8
          if (def.name === 'Подчинение') baseValue = 8
          if (def.name === 'Сопротивляемость') baseValue = 2
          if (def.name === 'Доминантность') baseValue = 1
          if (def.name === 'Сексуальная опытность') baseValue = 1
          if (def.category === 'Состояния') baseValue = Math.random() * 2 + 1 // 1-3
          if (def.category === 'Фетиши') baseValue = Math.random() * 2 + 1 // 1-3
        } else if (character.name === 'Кай') {
          // Женственный, творческий, чувствительный, мягкий характер
          if (def.name === 'Чувствительность') baseValue = 8
          if (def.name === 'Эмпатия') baseValue = 8
          if (def.name === 'Творчество') baseValue = 9
          if (def.name === 'Мягкость') baseValue = 8
          if (def.name === 'Подчинение') baseValue = 6
          if (def.name === 'Доминантность') baseValue = 2
          if (def.name === 'Сопротивляемость') baseValue = 3
          if (def.name === 'Сексуальная опытность') baseValue = 3
          if (def.category === 'Состояния') baseValue = Math.random() * 2 + 1 // 1-3
          if (def.category === 'Фетиши') baseValue = Math.random() * 3 + 2 // 2-5
        } else if (character.name === 'Линь Сюэжань') {
          // Доминантная, умная, критичная, исследователь
          if (def.name === 'Доминантность') baseValue = 9
          if (def.name === 'Интеллект') baseValue = 9
          if (def.name === 'Сопротивляемость') baseValue = 8
          if (def.name === 'Критичность') baseValue = 8
          if (def.name === 'Подчинение') baseValue = 1
          if (def.name === 'Покорность') baseValue = 1
          if (def.name === 'Сексуальная опытность') baseValue = 6
          if (def.name === 'Самооценка') baseValue = 8
          if (def.category === 'Состояния') baseValue = Math.random() * 2 + 1 // 1-3
          if (def.category === 'Фетиши') baseValue = Math.random() * 2 + 1 // 1-3
        }

        await prisma.characteristic.create({
          data: {
            characterId: character.id,
            characteristicDefId: def.id,
            currentValue: baseValue,
            baseValue: baseValue,
            recoveryRate: 0.1,
            shiftThreshold: 60,
            shiftRate: 0.05,
            timeInAlteredState: 0
          }
        })
      }
    }

    // Создаем анатомию для каждого персонажа
    console.log('🦴 Создание анатомии для персонажей...')

    for (const character of createdCharacters) {
      for (const def of anatomyDefinitions) {
        let hasPart = true

        // Все персонажи женские, поэтому убираем мужские половые органы
        if (def.category === 'Половые органы (мужские)') {
          hasPart = false
        }

        // Генерируем случайную чувствительность (20-80)
        let sensitivity = Math.random() * 60 + 20

        // Специальная чувствительность для Анечки
        if (character.name === 'Анечка') {
          sensitivity = Math.random() * 40 + 60 // 60-100 - очень чувствительная
        }

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

    // Создаем позы для каждого персонажа
    console.log('🧘 Создание поз для персонажей...')

    for (const character of createdCharacters) {
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

    console.log('🎉 Персонажи успешно созданы!')
    console.log(`📊 Создано персонажей: ${createdCharacters.length}`)
    console.log(`📊 Характеристик на персонажа: ${charDefinitions.length}`)
    console.log(`📊 Частей тела на персонажа: ${anatomyDefinitions.length}`)
    console.log(`📊 Поз на персонажа: ${poseDefinitions.length}`)

    // Выводим информацию о персонажах
    console.log('\n👥 Созданные персонажи:')
    for (const char of createdCharacters) {
      console.log(`- ${char.name} (${char.age} лет): ${char.description}`)
    }

  } catch (error) {
    console.error('❌ Ошибка при создании персонажей:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем скрипт
cleanupCharacters()
  .then(() => {
    console.log('✅ Скрипт завершен успешно')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Ошибка выполнения скрипта:', error)
    process.exit(1)
  })
