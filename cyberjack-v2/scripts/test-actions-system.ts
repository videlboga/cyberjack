// scripts/test-actions-system.ts

import { ActionsSystem } from '../lib/core/actions/actions-system'
import { prisma } from '../lib/db/client'

async function testActionsSystem() {
  console.log('🧪 Тестирование новой системы действий...\n')

  try {
    const actionsSystem = new ActionsSystem()

    // 1. Создаем тестовое действие с формулой
    console.log('1. Создание тестового действия...')
    const testAction = await actionsSystem.createAction({
      name: 'Тестовая ласка',
      category: 'физическое',
      description: 'Тестовое действие для проверки системы формул',
      intensity: 50,
      formula: {}, // Пустая формула - будет использован fallback
      requirements: {}
    })

    console.log('✅ Действие создано:', testAction.name)

    // 2. Создаем тестового персонажа
    console.log('\n2. Создание тестового персонажа...')
    const testCharacter = await prisma.character.create({
      data: {
        name: 'Тестовый персонаж',
        description: 'Персонаж для тестирования действий',
        age: 25,
        isActive: true
      }
    })

    // Получаем или создаем определение характеристики настроения
    let moodDef = await prisma.characteristicDefinition.findUnique({
      where: { id: 'mood' }
    })

    if (!moodDef) {
      moodDef = await prisma.characteristicDefinition.create({
        data: {
          id: 'mood',
          name: 'Настроение',
          category: 'психическое',
          description: 'Уровень настроения персонажа',
          minValue: 0,
          maxValue: 100,
          isActive: true
        }
      })
    }

    // Добавляем характеристику настроения
    const moodChar = await prisma.characteristic.create({
      data: {
        characterId: testCharacter.id,
        characteristicDefId: moodDef.id,
        currentValue: 50,
        baseValue: 50,
        recoveryRate: 1.0
      }
    })

    console.log('✅ Персонаж создан:', testCharacter.name)

    // 3. Получаем существующего пользователя или создаем нового
    console.log('\n3. Получение тестового пользователя...')
    let testUser = await prisma.user.findFirst({
      where: { email: 'test@example.com' }
    })

    if (!testUser) {
      testUser = await prisma.user.create({
        data: {
          email: 'test@example.com',
          name: 'Тестовый пользователь',
          role: 'USER',
          credits: 1000,
          modifiers: {
            mood: 1.0
          }
        }
      })
    }

    console.log('✅ Пользователь получен:', testUser.name)

    // 4. Тестируем выполнение действия без зоны
    console.log('\n4. Тестирование выполнения действия...')
    const result = await actionsSystem.executeActionWithHold(
      testCharacter.id,
      testAction.id,
      testUser.id,
      '', // без зоны
      3 // 3 секунды холда
    )

    console.log('✅ Действие выполнено!')
    console.log('Результат:', {
      success: result.success,
      message: result.message,
      effects: result.effects
    })

    // 6. Проверяем логи действий
    console.log('\n6. Проверка логов действий...')
    const logs = await prisma.actionLog.findMany({
      where: {
        actionId: testAction.id,
        characterId: testCharacter.id
      }
    })

    console.log('✅ Логи найдены:', logs.length)
    if (logs.length > 0) {
      console.log('Последний лог:', {
        duration: logs[0].duration,
        intensity: logs[0].intensity,
        success: logs[0].success,
        timestamp: logs[0].timestamp
      })
    }

    // 7. Проверяем изменения характеристик
    console.log('\n7. Проверка изменений характеристик...')
    const updatedChar = await prisma.characteristic.findUnique({
      where: {
        characterId_characteristicDefId: {
          characterId: testCharacter.id,
          characteristicDefId: 'mood'
        }
      }
    })

    console.log('✅ Характеристика обновлена:')
    console.log('Было: 50, Стало:', updatedChar?.currentValue)

    console.log('\n🎉 Все тесты прошли успешно!')

  } catch (error) {
    console.error('❌ Ошибка при тестировании:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем тест
testActionsSystem()
