#!/usr/bin/env tsx

import { prisma } from '../lib/db/client'
import { FormulaSystem } from '../lib/core/formulas/formula-system'

async function testSimpleFormula() {
  console.log('🧪 Тестируем простую формулу...\n')

  try {
    const formulaSystem = new FormulaSystem()

    // Создаем простую формулу без условий
    const simpleFormula = {
      id: 'test_simple_formula',
      name: 'Простая тестовая формула',
      description: 'Простая формула для тестирования',
      rootNode: {
        id: 'test_root',
        type: 'value',
        dataType: 'object',
        value: {
          'Настроение': {
            change: {
              id: 'test_mood_change',
              type: 'value',
              dataType: 'number',
              value: 5
            },
            permanent: {
              id: 'test_mood_permanent',
              type: 'value',
              dataType: 'boolean',
              value: false
            }
          }
        }
      },
      version: '2.0',
      createdAt: new Date(),
      updatedAt: new Date()
    }

    // Создаем простой контекст
    const context = {
      character: {
        id: 'test-character',
        characteristics: {
          'Настроение': 50,
          'Доверие': 40,
          'Энергия': 60
        }
      },
      user: {
        id: 'test-user',
        modifiers: {
          general: 1.0
        }
      },
      action: {
        id: 'test-action',
        intensity: 75
      },
      system: {
        gameTime: {
          current: new Date(),
          gameTime: 0
        }
      }
    }

    console.log('🔬 Тестируем простую формулу...')
    console.log('📋 Формула:', JSON.stringify(simpleFormula, null, 2))
    console.log('📋 Контекст:', JSON.stringify(context, null, 2))

    try {
      const result = await formulaSystem.executeFormula(simpleFormula, context)

      console.log('✅ Формула выполнена успешно!')
      console.log('📊 Результат:', JSON.stringify(result, null, 2))

    } catch (error) {
      console.error('❌ Ошибка выполнения формулы:', error)

      if (error instanceof Error) {
        console.error('📝 Сообщение:', error.message)
        console.error('📚 Стек:', error.stack)
      }
    }

  } catch (error) {
    console.error('❌ Критическая ошибка:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем тест
testSimpleFormula().catch(console.error)
