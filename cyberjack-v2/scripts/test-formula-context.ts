#!/usr/bin/env tsx

import { prisma } from '../lib/db/client'
import { ActionsSystem } from '../lib/core/actions/actions-system'

async function testFormulaContext() {
  console.log('🧪 Тестируем контекст формул...\n')

  try {
    const actionsSystem = new ActionsSystem()

    const characterId = 'cmfkv6rlo0002hxtm7atmgy6r'
    const userId = 'cmfjeu4430000hxhpz4r17ol8'
    const actionId = 'cmfku3qu1000dhxv7w7bqoe3x'

    // Получаем персонажа с характеристиками
    const character = await prisma.character.findUnique({
      where: { id: characterId },
      include: {
        characteristics: {
          include: {
            definition: true
          }
        }
      }
    })

    if (!character) {
      console.error('❌ Персонаж не найден')
      return
    }

    console.log(`🎭 Персонаж: ${character.name}`)
    console.log(`📊 Характеристик: ${character.characteristics.length}`)

    // Показываем первые 5 характеристик
    character.characteristics.slice(0, 5).forEach(char => {
      console.log(`   - ${char.definition?.name}: ${char.currentValue}`)
    })

    // Получаем пользователя
    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      console.error('❌ Пользователь не найден')
      return
    }

    console.log(`👤 Пользователь: ${user.name}`)

    // Получаем действие
    const action = await prisma.action.findUnique({
      where: { id: actionId }
    })

    if (!action) {
      console.error('❌ Действие не найден')
      return
    }

    console.log(`🎯 Действие: ${action.name}`)
    console.log(`📝 Формула: ${action.formula ? 'Есть' : 'Нет'}`)

    // Тестируем форматирование характеристик
    console.log('\n🔍 Тестируем форматирование характеристик...')

    // Создаем контекст как в ActionsSystem
    const context = {
      character: {
        id: character.id,
        name: character.name,
        characteristics: actionsSystem['formatCharacterCharacteristics'](character.characteristics),
        anatomy: {}
      },
      user: {
        id: user.id,
        name: user.name,
        modifiers: user.modifiers || {},
        credits: user.credits || 0
      },
      action: {
        id: action.id,
        name: action.name,
        intensity: action.intensity,
        cost: 0,
        duration: 5,
        category: action.category,
        effects: action.formula || {}
      },
      zone: null,
      system: {
        gameTime: {
          current: new Date().toISOString(),
          gameTime: 0
        },
        realTime: Date.now(),
        isActionHolding: false,
        timeMultiplier: 1.0
      }
    }

    console.log('\n📋 Контекст характеристик:')
    const charKeys = Object.keys(context.character.characteristics)
    console.log(`   Доступно характеристик: ${charKeys.length}`)
    charKeys.slice(0, 10).forEach(key => {
      console.log(`   - ${key}: ${context.character.characteristics[key]}`)
    })

    // Проверяем конкретные характеристики
    const testCharacteristics = ['Энергия', 'Настроение', 'Доверие']
    console.log('\n🔍 Проверяем конкретные характеристики:')
    testCharacteristics.forEach(charName => {
      const value = context.character.characteristics[charName]
      console.log(`   - ${charName}: ${value !== undefined ? value : 'НЕ НАЙДЕНА'}`)
    })

  } catch (error) {
    console.error('❌ Ошибка:', error)
  } finally {
    await prisma.$disconnect()
  }
}

testFormulaContext().catch(console.error)
