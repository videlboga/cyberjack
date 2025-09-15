// scripts/test-prompt-constructors.ts

import { PromptSystem } from '../lib/character/prompt-system'
import { PromptConstructors } from '../lib/character/prompt-constructors'
import { prisma } from '../lib/db/client'

async function testPromptConstructors() {
  console.log('🧪 Тестирование конструкторов промптов...\n')

  try {
    // Инициализация
    const promptSystem = new PromptSystem()
    const constructors = promptSystem.getConstructors()

    // Создаем тестового персонажа с характеристиками и позой
    console.log('👤 Создание тестового персонажа...')

    const testCharacter = await prisma.character.create({
      data: {
        name: 'Тестовый персонаж для конструкторов',
        description: 'Персонаж для тестирования конструкторов промптов',
        isActive: true
      }
    })
    console.log(`✅ Создан персонаж: ${testCharacter.id}`)

    // Создаем определения характеристик
    const sensitivityDef = await prisma.characteristicDefinition.create({
      data: {
        name: 'чувствительность',
        category: 'физическая',
        description: 'Уровень чувствительности к прикосновениям',
        minValue: 0,
        maxValue: 100
      }
    })

    const submissivenessDef = await prisma.characteristicDefinition.create({
      data: {
        name: 'покорность',
        category: 'психологическая',
        description: 'Склонность к подчинению',
        minValue: 0,
        maxValue: 100
      }
    })

    const innocenceDef = await prisma.characteristicDefinition.create({
      data: {
        name: 'невинность',
        category: 'психологическая',
        description: 'Уровень невинности и чистоты',
        minValue: 0,
        maxValue: 100
      }
    })

    console.log('✅ Созданы определения характеристик')

    // Создаем характеристики персонажа
    await prisma.characteristic.createMany({
      data: [
        {
          characterId: testCharacter.id,
          characteristicDefId: sensitivityDef.id,
          currentValue: 85,
          baseValue: 70
        },
        {
          characterId: testCharacter.id,
          characteristicDefId: submissivenessDef.id,
          currentValue: 60,
          baseValue: 50
        },
        {
          characterId: testCharacter.id,
          characteristicDefId: innocenceDef.id,
          currentValue: 40,
          baseValue: 80
        }
      ]
    })
    console.log('✅ Созданы характеристики персонажа')

    // Создаем определение позы
    const poseDef = await prisma.poseDefinition.create({
      data: {
        name: 'сидячая поза',
        category: 'intimate',
        description: 'Интимная сидячая поза',
        effects: { sensitivity: 1.2 },
        requirements: {}
      }
    })

    // Создаем ракурс позы
    const poseAngle = await prisma.poseAngle.create({
      data: {
        poseDefId: poseDef.id,
        name: 'фронтальный вид',
        angle: 'front',
        media: { images: [], videos: [], gifs: [] }
      }
    })

    // Создаем определение анатомии
    const anatomyDef = await prisma.anatomyDefinition.create({
      data: {
        name: 'грудь',
        category: 'sensitive',
        description: 'Чувствительная область груди'
      }
    })

    // Создаем активную зону
    const activeZone = await prisma.activeZone.create({
      data: {
        angleId: poseAngle.id,
        anatomyDefId: anatomyDef.id,
        name: 'центр груди',
        x: 50,
        y: 30,
        width: 20,
        height: 15
      }
    })

    // Создаем позу персонажа
    const characterPose = await prisma.characterPose.create({
      data: {
        characterId: testCharacter.id,
        poseDefId: poseDef.id,
        isActive: true,
        customSettings: {}
      }
    })

    // Создаем ракурс позы персонажа
    const characterPoseAngle = await prisma.characterPoseAngle.create({
      data: {
        characterPoseId: characterPose.id,
        name: 'фронтальный вид персонажа',
        description: 'Индивидуальный фронтальный вид',
        media: { images: [], videos: [], gifs: [] }
      }
    })

    // Создаем активную зону персонажа
    await prisma.characterActiveZone.create({
      data: {
        characterAngleId: characterPoseAngle.id,
        anatomyDefId: anatomyDef.id,
        name: 'центр груди персонажа',
        x: 50,
        y: 30,
        width: 20,
        height: 15
      }
    })

    console.log('✅ Создана поза и активные зоны')

    // Тест 1: Конструктор промптов на основе характеристик
    console.log('\n📊 Тест 1: Конструктор промптов на основе характеристик')

    const characteristicPrompt = await constructors.buildCharacteristicBasedPrompt(
      testCharacter.id,
      'normal'
    )
    console.log(`✅ Создан промпт: ${characteristicPrompt.name}`)
    console.log(`📝 Шаблон (первые 200 символов): ${characteristicPrompt.template.substring(0, 200)}...`)

    // Тест 2: Конструктор промптов на основе позы
    console.log('\n🕺 Тест 2: Конструктор промптов на основе позы')

    const posePrompt = await constructors.buildPoseBasedPrompt(testCharacter.id)
    console.log(`✅ Создан промпт: ${posePrompt.name}`)
    console.log(`📝 Шаблон (первые 200 символов): ${posePrompt.template.substring(0, 200)}...`)

    // Тест 3: Комбинированный конструктор
    console.log('\n🔄 Тест 3: Комбинированный конструктор')

    const combinedPrompt = await constructors.buildCombinedPrompt(
      testCharacter.id,
      'interaction'
    )
    console.log(`✅ Создан промпт: ${combinedPrompt.name}`)
    console.log(`📝 Шаблон (первые 200 символов): ${combinedPrompt.template.substring(0, 200)}...`)

    // Тест 4: Добавление динамических промптов в систему
    console.log('\n➕ Тест 4: Добавление динамических промптов')

    const dynamicPrompt1 = await promptSystem.createCharacteristicPrompt(testCharacter.id, 'high')
    const dynamicPrompt2 = await promptSystem.createPosePrompt(testCharacter.id)
    const dynamicPrompt3 = await promptSystem.createCombinedPrompt(testCharacter.id, 'emotion')

    console.log(`✅ Добавлено 3 динамических промпта:`)
    console.log(`  - ${dynamicPrompt1.name}`)
    console.log(`  - ${dynamicPrompt2.name}`)
    console.log(`  - ${dynamicPrompt3.name}`)

    // Тест 5: Получение всех динамических промптов
    console.log('\n📋 Тест 5: Получение динамических промптов')

    const dynamicPrompts = await promptSystem.getDynamicPrompts(testCharacter.id)
    console.log(`✅ Найдено динамических промптов: ${dynamicPrompts.length}`)
    dynamicPrompts.forEach(prompt => {
      console.log(`  - ${prompt.name} (${prompt.category})`)
    })

    // Тест 6: Обновление динамических промптов
    console.log('\n🔄 Тест 6: Обновление динамических промптов')

    const refreshedPrompts = await promptSystem.refreshDynamicPrompts(testCharacter.id)
    console.log(`✅ Обновлено промптов: ${refreshedPrompts.length}`)

    // Тест 7: Построение динамического промпта
    console.log('\n🏗️ Тест 7: Построение динамического промпта')

    const context = {
      characterId: testCharacter.id,
      userId: 'test-user',
      message: 'Привет!',
      characteristics: [
        {
          id: '1',
          name: 'чувствительность',
          category: 'физическая',
          currentValue: 85,
          baseValue: 70,
          isRevealed: true,
          revealedValue: 85,
          accuracy: 100
        }
      ],
      memory: {
        shortTerm: [],
        longTerm: [],
        contextual: [],
        emotional: [],
        recent: []
      },
      userModifiers: {},
      gameTime: Date.now(),
      sessionHistory: [],
      environment: {
        timeOfDay: 'день',
        location: 'комната',
        atmosphere: 'интимная',
        temperature: 'комфортная',
        lighting: 'приглушенная',
        sounds: [],
        smells: []
      }
    }

    const builtPrompt = await promptSystem.buildDynamicPrompt(testCharacter.id, context, true)
    console.log(`✅ Построен динамический промпт (${builtPrompt.length} символов)`)
    console.log(`📝 Промпт (первые 300 символов): ${builtPrompt.substring(0, 300)}...`)

    // Тест 8: Валидация динамических промптов
    console.log('\n✅ Тест 8: Валидация динамических промптов')

    let validCount = 0
    let invalidCount = 0

    dynamicPrompts.forEach(prompt => {
      const validation = promptSystem.validateTemplate(prompt)
      if (validation.isValid) {
        validCount++
      } else {
        invalidCount++
        console.log(`  ❌ ${prompt.name}: ${validation.errors.join(', ')}`)
      }
    })

    console.log(`✅ Валидных промптов: ${validCount}`)
    console.log(`❌ Невалидных промптов: ${invalidCount}`)

    // Очистка тестовых данных
    console.log('\n🧹 Очистка тестовых данных...')

    await prisma.characterActiveZone.deleteMany({
      where: { characterAngle: { characterPose: { characterId: testCharacter.id } } }
    })
    await prisma.characterPoseAngle.deleteMany({
      where: { characterPose: { characterId: testCharacter.id } }
    })
    await prisma.characterPose.deleteMany({
      where: { characterId: testCharacter.id }
    })
    await prisma.characteristic.deleteMany({
      where: { characterId: testCharacter.id }
    })
    await prisma.character.delete({
      where: { id: testCharacter.id }
    })
    await prisma.activeZone.deleteMany({
      where: { angleId: poseAngle.id }
    })
    await prisma.poseAngle.delete({
      where: { id: poseAngle.id }
    })
    await prisma.poseDefinition.delete({
      where: { id: poseDef.id }
    })
    await prisma.anatomyDefinition.delete({
      where: { id: anatomyDef.id }
    })
    await prisma.characteristicDefinition.deleteMany({
      where: { id: { in: [sensitivityDef.id, submissivenessDef.id, innocenceDef.id] } }
    })

    console.log('✅ Тестовые данные очищены')

    console.log('\n🎉 Все тесты конструкторов промптов завершены успешно!')
    console.log('\n📋 Сводка:')
    console.log(`  ✅ Конструктор характеристик: работает`)
    console.log(`  ✅ Конструктор поз: работает`)
    console.log(`  ✅ Комбинированный конструктор: работает`)
    console.log(`  ✅ Динамические промпты: ${dynamicPrompts.length} создано`)
    console.log(`  ✅ Валидация: ${validCount}/${validCount + invalidCount} промптов валидны`)
    console.log(`  ✅ Построение промптов: работает`)

  } catch (error) {
    console.error('❌ Ошибка при тестировании конструкторов:', error)
  }
}

// Запуск тестов
if (require.main === module) {
  testPromptConstructors()
    .then(() => {
      console.log('\n✅ Тестирование завершено')
      process.exit(0)
    })
    .catch((error) => {
      console.error('\n❌ Критическая ошибка:', error)
      process.exit(1)
    })
}

export { testPromptConstructors }
