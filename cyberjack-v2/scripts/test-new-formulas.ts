#!/usr/bin/env tsx

import { prisma } from '../lib/db/client'
import { ActionsSystem } from '../lib/core/actions/actions-system'
import { FormulaSystem } from '../lib/core/formulas/formula-system'

async function testNewFormulas() {
  console.log('🧪 Тестируем новые формулы...\n')

  try {
    const actionsSystem = new ActionsSystem()
    const formulaSystem = new FormulaSystem()

    // Получаем действие с новой формулой
    const action = await prisma.action.findFirst({
      where: {
        name: 'Нежность'
      }
    })

    if (!action) {
      console.error('❌ Действие "Нежность" не найдено')
      return
    }

    console.log(`🎯 Тестируем действие: ${action.name}`)
    console.log(`📋 Формула ID: ${action.formula?.id || 'Нет ID'}`)
    console.log(`📊 Есть rootNode: ${!!(action.formula as any)?.rootNode}`)

    if ((action.formula as any)?.rootNode) {
      console.log(`🔍 Тип rootNode: ${(action.formula as any).rootNode.type}`)
    }

    // Создаем тестовый контекст
    const testContext = {
      character: {
        id: 'test-character',
        characteristics: {
          mood: 60,
          trust: 40,
          arousal: 30
        }
      },
      action: {
        id: action.id,
        intensity: 75
      },
      user: {
        id: 'test-user',
        modifiers: {
          general: 1.0
        }
      },
      zone: {
        id: 'test-zone',
        modifiers: {}
      },
      system: {
        gameTime: {
          current: new Date(),
          gameTime: 0
        }
      }
    }

    console.log('\n🔬 Тестируем выполнение формулы...')

    try {
      const result = await formulaSystem.executeFormula(
        action.formula as any,
        testContext
      )

      console.log('✅ Формула выполнена успешно!')
      console.log('📊 Результат:', JSON.stringify(result, null, 2))

    } catch (error) {
      console.error('❌ Ошибка выполнения формулы:', error)

      // Показываем детали ошибки
      if (error instanceof Error) {
        console.error('📝 Сообщение:', error.message)
        console.error('📚 Стек:', error.stack)
      }
    }

    console.log('\n🎮 Тестируем выполнение действия...')
    console.log(`🔍 ID действия: ${action.id}`)

    // Проверяем, что действие существует в базе данных
    const actionInDb = await prisma.action.findUnique({
      where: { id: action.id }
    })

    if (!actionInDb) {
      console.error('❌ Действие не найдено в базе данных')
      return
    }

    console.log('✅ Действие найдено в базе данных')
    console.log('📋 Действие в БД:', JSON.stringify(actionInDb, null, 2))

    try {
      const actionResult = await actionsSystem.executeActionWithHold(
        action.id,
        'cmfkv6rlo0002hxtm7atmgy6r', // Реальный ID персонажа
        'cmfjeu4430000hxhpz4r17ol8', // Реальный ID пользователя
        'test-zone',
        5 // 5 секунд
      )

      console.log('✅ Действие выполнено успешно!')
      console.log('📊 Результат:', JSON.stringify(actionResult, null, 2))

    } catch (error) {
      console.error('❌ Ошибка выполнения действия:', error)

      if (error instanceof Error) {
        console.error('📝 Сообщение:', error.message)
      }
    }

  } catch (error) {
    console.error('❌ Критическая ошибка:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем тест
testNewFormulas().catch(console.error)
