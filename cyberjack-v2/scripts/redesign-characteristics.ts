#!/usr/bin/env tsx

import { prisma } from '../lib/db/client'

// Полная система характеристик для NSFW BDSM игры
const CHARACTERISTIC_SYSTEM = {
  // ФИЗИЧЕСКИЕ ХАРАКТЕРИСТИКИ
  physical: [
    { name: 'Энергия', description: 'Физическая энергия и выносливость', min: 0, max: 100, default: 80 },
    { name: 'Выносливость', description: 'Способность выдерживать длительные воздействия', min: 0, max: 100, default: 50 },
    { name: 'Гибкость', description: 'Физическая гибкость и подвижность', min: 0, max: 100, default: 60 },
    { name: 'Чувствительность', description: 'Общая чувствительность к прикосновениям', min: 0, max: 100, default: 50 },
    { name: 'Боль', description: 'Уровень испытываемой боли', min: 0, max: 100, default: 0 },
    { name: 'Усталость', description: 'Уровень физической усталости', min: 0, max: 100, default: 20 },
    { name: 'Здоровье', description: 'Общее физическое состояние', min: 0, max: 100, default: 90 }
  ],

  // ЭМОЦИОНАЛЬНЫЕ ХАРАКТЕРИСТИКИ
  emotional: [
    { name: 'Настроение', description: 'Общее эмоциональное состояние', min: 0, max: 100, default: 50 },
    { name: 'Доверие', description: 'Уровень доверия к пользователю', min: 0, max: 100, default: 30 },
    { name: 'Стресс', description: 'Уровень психологического стресса', min: 0, max: 100, default: 20 },
    { name: 'Страх', description: 'Уровень страха и тревожности', min: 0, max: 100, default: 10 },
    { name: 'Стыд', description: 'Уровень стыда и смущения', min: 0, max: 100, default: 15 },
    { name: 'Унижение', description: 'Уровень чувства унижения', min: 0, max: 100, default: 5 },
    { name: 'Отчаяние', description: 'Уровень отчаяния и безнадежности', min: 0, max: 100, default: 5 },
    { name: 'Гордость', description: 'Уровень самоуважения и гордости', min: 0, max: 100, default: 40 },
    { name: 'Самооценка', description: 'Уровень самооценки', min: 0, max: 100, default: 35 },
    { name: 'Эмоциональная стабильность', description: 'Устойчивость к эмоциональным воздействиям', min: 0, max: 100, default: 60 }
  ],

  // СЕКСУАЛЬНЫЕ ХАРАКТЕРИСТИКИ
  sexual: [
    { name: 'Возбуждение', description: 'Уровень сексуального возбуждения', min: 0, max: 100, default: 0 },
    { name: 'Сексуальная опытность', description: 'Уровень сексуального опыта', min: 0, max: 100, default: 20 },
    { name: 'Невинность', description: 'Уровень невинности и чистоты', min: 0, max: 100, default: 80 },
    { name: 'Покорность', description: 'Уровень покорности и подчинения', min: 0, max: 100, default: 30 },
    { name: 'Доминирование', description: 'Склонность к доминированию', min: 0, max: 100, default: 10 },
    { name: 'Садизм', description: 'Склонность к садизму', min: 0, max: 100, default: 5 },
    { name: 'Мазохизм', description: 'Склонность к мазохизму', min: 0, max: 100, default: 15 },
    { name: 'Зависимость', description: 'Психологическая зависимость от пользователя', min: 0, max: 100, default: 10 },
    { name: 'Собственность', description: 'Чувство принадлежности пользователю', min: 0, max: 100, default: 5 }
  ],

  // СОЦИАЛЬНЫЕ ХАРАКТЕРИСТИКИ
  social: [
    { name: 'Общительность', description: 'Склонность к общению', min: 0, max: 100, default: 40 },
    { name: 'Эмпатия', description: 'Способность к сопереживанию', min: 0, max: 100, default: 70 },
    { name: 'Интеллект', description: 'Уровень интеллекта', min: 0, max: 100, default: 60 },
    { name: 'Любопытство', description: 'Уровень любознательности', min: 0, max: 100, default: 50 },
    { name: 'Оптимизм', description: 'Склонность к оптимизму', min: 0, max: 100, default: 45 },
    { name: 'Адаптивность', description: 'Способность адаптироваться к изменениям', min: 0, max: 100, default: 55 }
  ],

  // ФЕТИШИ И ПРЕДПОЧТЕНИЯ
  fetishes: [
    { name: 'Хенд-фетиш', description: 'Интерес к рукам', min: 0, max: 100, default: 20 },
    { name: 'Брест-фетиш', description: 'Интерес к груди', min: 0, max: 100, default: 25 },
    { name: 'Анал-фетиш', description: 'Интерес к анальным практикам', min: 0, max: 100, default: 10 },
    { name: 'Фут-фетиш', description: 'Интерес к ногам', min: 0, max: 100, default: 15 },
    { name: 'Латекс/кожа', description: 'Интерес к латексу и коже', min: 0, max: 100, default: 20 },
    { name: 'Резинки/верёвки', description: 'Интерес к бондажу', min: 0, max: 100, default: 15 },
    { name: 'Униформа', description: 'Интерес к униформе', min: 0, max: 100, default: 25 },
    { name: 'Запретное', description: 'Интерес к запретным практикам', min: 0, max: 100, default: 10 }
  ],

  // СПЕЦИАЛЬНЫЕ СОСТОЯНИЯ
  special: [
    { name: 'Сенсорная депривация', description: 'Уровень сенсорной депривации', min: 0, max: 100, default: 0 },
    { name: 'Сенсорная перегрузка', description: 'Уровень сенсорной перегрузки', min: 0, max: 100, default: 0 },
    { name: 'Щекотка', description: 'Чувствительность к щекотке', min: 0, max: 100, default: 30 },
    { name: 'Вибрации', description: 'Чувствительность к вибрациям', min: 0, max: 100, default: 40 },
    { name: 'Беременность', description: 'Состояние беременности', min: 0, max: 100, default: 0 },
    { name: 'Лактация', description: 'Способность к лактации', min: 0, max: 100, default: 0 },
    { name: 'Менструация', description: 'Менструальный цикл', min: 0, max: 100, default: 0 },
    { name: 'Эдж-плей', description: 'Состояние эдж-плея', min: 0, max: 100, default: 0 },
    { name: 'Ограничение дыхания', description: 'Уровень ограничения дыхания', min: 0, max: 100, default: 0 }
  ]
}

async function redesignCharacteristics() {
  console.log('🔄 Перерабатываем систему характеристик...\n')

  try {
    // 1. Удаляем все старые характеристики
    console.log('🗑️  Удаляем старые характеристики...')
    await prisma.characteristic.deleteMany({})
    await prisma.characteristicDefinition.deleteMany({})
    console.log('✅ Старые характеристики удалены\n')

    // 2. Создаем новые определения характеристик
    console.log('➕ Создаем новые определения характеристик...')
    const createdDefs: { [key: string]: any } = {}

    for (const [category, characteristics] of Object.entries(CHARACTERISTIC_SYSTEM)) {
      console.log(`📂 Категория: ${category}`)

      for (const char of characteristics) {
        const charDef = await prisma.characteristicDefinition.create({
          data: {
            name: char.name,
            category: category,
            description: char.description,
            minValue: char.min,
            maxValue: char.max,
            isActive: true
          }
        })

        createdDefs[char.name] = charDef
        console.log(`   ✅ ${char.name}`)
      }
    }

    console.log(`\n✅ Создано ${Object.keys(createdDefs).length} определений характеристик\n`)

    // 3. Добавляем характеристики всем персонажам
    console.log('👥 Добавляем характеристики персонажам...')
    const characters = await prisma.character.findMany()

    for (const character of characters) {
      console.log(`🎭 Персонаж: ${character.name}`)

      for (const [charName, charDef] of Object.entries(createdDefs)) {
        const charData = Object.values(CHARACTERISTIC_SYSTEM)
          .flat()
          .find(c => c.name === charName)

        if (!charData) continue

        await prisma.characteristic.create({
          data: {
            characterId: character.id,
            characteristicDefId: charDef.id,
            currentValue: charData.default,
            baseValue: charData.default,
            recoveryRate: 1.0,
            shiftThreshold: 60,
            shiftRate: 0.1,
            timeInAlteredState: 0,
            lastChanged: new Date(),
            lastRecovery: new Date()
          }
        })
      }

      console.log(`   ✅ Добавлено ${Object.keys(createdDefs).length} характеристик`)
    }

    console.log('\n🎉 Переработка характеристик завершена!')
    console.log(`📊 Всего категорий: ${Object.keys(CHARACTERISTIC_SYSTEM).length}`)
    console.log(`📊 Всего характеристик: ${Object.keys(createdDefs).length}`)
    console.log(`👥 Персонажей обновлено: ${characters.length}`)

    // 4. Выводим список всех характеристик для справки
    console.log('\n📋 Полный список характеристик:')
    for (const [category, characteristics] of Object.entries(CHARACTERISTIC_SYSTEM)) {
      console.log(`\n${category.toUpperCase()}:`)
      for (const char of characteristics) {
        console.log(`  - ${char.name}: ${char.description}`)
      }
    }

  } catch (error) {
    console.error('❌ Критическая ошибка:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем переработку
redesignCharacteristics().catch(console.error)
