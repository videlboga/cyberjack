#!/usr/bin/env tsx

import { prisma } from '../lib/db/client'
import { FormulaConverter } from '../lib/core/formulas/formula-converter'

// Маппинг старых характеристик на новые
const CHARACTERISTIC_MAPPING = {
  // Старые -> Новые
  'Настроение': 'Настроение',
  'Доверие': 'Доверие',
  'Энергия': 'Энергия',
  'Стресс': 'Стресс',
  'Смущение': 'Стыд',
  'Чувствительность': 'Чувствительность',
  'Возбуждение': 'Возбуждение',
  'Боль': 'Боль',
  'Страх': 'Страх',
  'Унижение': 'Унижение',
  'Покорность': 'Покорность',
  'Зависимость': 'Зависимость'
}

// Новые формулы для разных типов действий
const NEW_FORMULA_TEMPLATES = {
  physical: {
    'Настроение': { change: 3, permanent: false },
    'Энергия': { change: -2, permanent: false },
    'Чувствительность': { change: 1, permanent: false }
  },
  emotional: {
    'Настроение': { change: 8, permanent: false },
    'Доверие': { change: 3, permanent: false },
    'Стресс': { change: -2, permanent: false }
  },
  sexual: {
    'Возбуждение': { change: 10, permanent: false },
    'Чувствительность': { change: 5, permanent: false },
    'Стыд': { change: 3, permanent: false }
  },
  pain: {
    'Боль': { change: 15, permanent: false },
    'Страх': { change: 8, permanent: false },
    'Покорность': { change: 5, permanent: false }
  },
  comfort: {
    'Настроение': { change: 6, permanent: false },
    'Стресс': { change: -5, permanent: false },
    'Доверие': { change: 2, permanent: false }
  }
}

async function updateFormulasForNewCharacteristics() {
  console.log('🔄 Обновляем формулы под новые характеристики...\n')

  try {
    const converter = new FormulaConverter()

    // Получаем все действия с формулами
    const actions = await prisma.action.findMany({
      where: {
        formula: {
          not: null
        }
      }
    })

    console.log(`📊 Найдено действий для обновления: ${actions.length}\n`)

    let updatedCount = 0

    for (const action of actions) {
      console.log(`🎯 Обновляем: ${action.name}`)

      try {
        // Определяем тип действия
        const actionTypeMapping: Record<string, 'physical' | 'emotional' | 'sexual' | 'pain' | 'comfort'> = {
          'Погладить': 'physical',
          'Массаж': 'physical',
          'Обнять': 'physical',
          'Поцеловать': 'physical',
          'Забота': 'emotional',
          'Нежность': 'emotional',
          'Похвала': 'emotional',
          'Поддержка': 'emotional',
          'Нейронный осциллятор': 'sexual',
          'Тактильный стимулятор': 'sexual',
          'Клиторальный модулятор': 'sexual',
          'Ректо-анализатор': 'sexual',
          'Ударить': 'pain',
          'Плеть': 'pain',
          'Шокер': 'pain',
          'Электромагнитный импульсор': 'pain',
          'Компрессионный пресс': 'pain',
          'Грубость': 'emotional',
          'Насмешка': 'emotional',
          'Унижение': 'emotional',
          'Фонаторный супрессор': 'pain',
          'Терморегулятор': 'physical'
        }

        const actionType = actionTypeMapping[action.name] || 'physical'

        // Получаем шаблон эффектов для этого типа действия
        const effectsTemplate = NEW_FORMULA_TEMPLATES[actionType]

        // Создаем новую формулу
        const newFormula = converter.createSpecializedFormula(
          action.name,
          actionType,
          effectsTemplate
        )

        // Обновляем действие в базе данных
        await prisma.action.update({
          where: { id: action.id },
          data: { formula: newFormula }
        })

        console.log(`✅ Обновлено успешно (тип: ${actionType})`)
        console.log(`📝 Новая формула ID: ${newFormula.id}`)
        updatedCount++

      } catch (error) {
        console.error(`❌ Ошибка при обновлении "${action.name}":`, error)
      }

      console.log('')
    }

    console.log('🎉 Обновление формул завершено!')
    console.log(`✅ Обновлено: ${updatedCount}`)
    console.log(`📊 Всего обработано: ${actions.length}`)

    // Выводим статистику по типам действий
    console.log('\n📊 Статистика по типам действий:')
    const typeStats: Record<string, number> = {}
    for (const action of actions) {
      const actionTypeMapping: Record<string, string> = {
        'Погладить': 'physical',
        'Массаж': 'physical',
        'Обнять': 'physical',
        'Поцеловать': 'physical',
        'Забота': 'emotional',
        'Нежность': 'emotional',
        'Похвала': 'emotional',
        'Поддержка': 'emotional',
        'Нейронный осциллятор': 'sexual',
        'Тактильный стимулятор': 'sexual',
        'Клиторальный модулятор': 'sexual',
        'Ректо-анализатор': 'sexual',
        'Ударить': 'pain',
        'Плеть': 'pain',
        'Шокер': 'pain',
        'Электромагнитный импульсор': 'pain',
        'Компрессионный пресс': 'pain',
        'Грубость': 'emotional',
        'Насмешка': 'emotional',
        'Унижение': 'emotional',
        'Фонаторный супрессор': 'pain',
        'Терморегулятор': 'physical'
      }

      const type = actionTypeMapping[action.name] || 'physical'
      typeStats[type] = (typeStats[type] || 0) + 1
    }

    for (const [type, count] of Object.entries(typeStats)) {
      console.log(`  ${type}: ${count} действий`)
    }

  } catch (error) {
    console.error('❌ Критическая ошибка:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем обновление
updateFormulasForNewCharacteristics().catch(console.error)
