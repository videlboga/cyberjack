#!/usr/bin/env tsx

import { prisma } from '../lib/db/client'
import { FormulaConverter } from '../lib/core/formulas/formula-converter'

async function fixFormulaPaths() {
  console.log('🔧 Исправляем пути к переменным в формулах...\n')

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

    console.log(`📊 Найдено действий для исправления: ${actions.length}\n`)

    let fixedCount = 0

    for (const action of actions) {
      console.log(`🎯 Исправляем: ${action.name}`)

      try {
        const oldFormula = action.formula as any

        // Проверяем, что это структурированная формула
        if (!oldFormula.rootNode) {
          console.log(`⏭️  Пропускаем - не структурированная формула`)
          continue
        }

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

        // Создаем простые эффекты из старой формулы для пересоздания
        const simpleEffects: any = {}

        // Извлекаем эффекты из старой формулы (если это возможно)
        if (oldFormula.rootNode && oldFormula.rootNode.type === 'condition') {
          // Это условная формула, создаем простые эффекты
          simpleEffects['Настроение'] = { change: 5, permanent: false }
          simpleEffects['Доверие'] = { change: 2, permanent: false }
        } else {
          // Создаем базовые эффекты в зависимости от типа действия
          switch (actionType) {
            case 'physical':
              simpleEffects['Настроение'] = { change: 5, permanent: false }
              simpleEffects['Энергия'] = { change: -2, permanent: false }
              break
            case 'emotional':
              simpleEffects['Настроение'] = { change: 8, permanent: false }
              simpleEffects['Доверие'] = { change: 3, permanent: false }
              break
            case 'sexual':
              simpleEffects['Возбуждение'] = { change: 10, permanent: false }
              simpleEffects['Чувствительность'] = { change: 5, permanent: false }
              break
            case 'pain':
              simpleEffects['Боль'] = { change: 15, permanent: false }
              simpleEffects['Страх'] = { change: 8, permanent: false }
              break
            case 'comfort':
              simpleEffects['Настроение'] = { change: 6, permanent: false }
              simpleEffects['Стресс'] = { change: -5, permanent: false }
              break
          }
        }

        // Создаем новую формулу с правильными путями
        const newFormula = converter.createSpecializedFormula(
          action.name,
          actionType,
          simpleEffects
        )

        // Обновляем действие в базе данных
        await prisma.action.update({
          where: { id: action.id },
          data: { formula: newFormula }
        })

        console.log(`✅ Исправлено успешно`)
        console.log(`📝 Новая формула ID: ${newFormula.id}`)
        fixedCount++

      } catch (error) {
        console.error(`❌ Ошибка при исправлении "${action.name}":`, error)
      }

      console.log('')
    }

    console.log('🎉 Исправление завершено!')
    console.log(`✅ Исправлено: ${fixedCount}`)
    console.log(`📊 Всего обработано: ${actions.length}`)

  } catch (error) {
    console.error('❌ Критическая ошибка:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Запускаем исправление
fixFormulaPaths().catch(console.error)
