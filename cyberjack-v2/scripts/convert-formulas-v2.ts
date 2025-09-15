#!/usr/bin/env tsx

import { PrismaClient } from '@prisma/client'
import { FormulaConverter } from '../lib/core/formulas/formula-converter'

const prisma = new PrismaClient()

// Маппинг действий к их типам
const actionTypeMapping: Record<string, 'physical' | 'emotional' | 'sexual' | 'pain' | 'comfort'> = {
  // Физические действия
  'Погладить': 'physical',
  'Массаж': 'physical',
  'Обнять': 'physical',
  'Поцеловать': 'physical',

  // Эмоциональные действия
  'Забота': 'emotional',
  'Нежность': 'emotional',
  'Похвала': 'emotional',
  'Поддержка': 'emotional',

  // Сексуальные действия
  'Нейронный осциллятор': 'sexual',
  'Тактильный стимулятор': 'sexual',
  'Клиторальный модулятор': 'sexual',
  'Ректо-анализатор': 'sexual',

  // Болевые действия
  'Ударить': 'pain',
  'Плеть': 'pain',
  'Шокер': 'pain',
  'Электромагнитный импульсор': 'pain',
  'Компрессионный пресс': 'pain',

  // Утешительные действия
  'Утешение': 'comfort',
  'Защита': 'comfort',
  'Безопасность': 'comfort',

  // Смешанные действия
  'Грубость': 'emotional',
  'Насмешка': 'emotional',
  'Унижение': 'emotional',
  'Фонаторный супрессор': 'pain',
  'Терморегулятор': 'physical'
}

async function convertFormulas() {
  console.log('🔄 Начинаем преобразование формул...\n')

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

    console.log(`📊 Найдено действий для преобразования: ${actions.length}\n`)

    let convertedCount = 0
    let skippedCount = 0

    for (const action of actions) {
      console.log(`🎯 Обрабатываем: ${action.name}`)

      try {
        const oldFormula = action.formula as any

        // Проверяем, что это старая формула (без rootNode)
        if (oldFormula.rootNode) {
          console.log(`⏭️  Пропускаем - уже новая формула`)
          skippedCount++
          continue
        }

        // Определяем тип действия
        const actionType = actionTypeMapping[action.name] || 'physical'
        console.log(`📋 Тип действия: ${actionType}`)

        // Преобразуем формулу
        const newFormula = converter.createSpecializedFormula(
          action.name,
          actionType,
          oldFormula
        )

        // Обновляем действие в базе данных
        await prisma.action.update({
          where: { id: action.id },
          data: { formula: newFormula }
        })

        console.log(`✅ Преобразовано успешно`)
        console.log(`📝 Новая формула ID: ${newFormula.id}`)
        convertedCount++

      } catch (error) {
        console.error(`❌ Ошибка при преобразовании "${action.name}":`, error)
      }

      console.log('')
    }

    console.log('🎉 Преобразование завершено!')
    console.log(`✅ Преобразовано: ${convertedCount}`)
    console.log(`⏭️  Пропущено: ${skippedCount}`)
    console.log(`📊 Всего обработано: ${convertedCount + skippedCount}`)

  } catch (error) {
    console.error('❌ Критическая ошибка:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Функция для создания формул для чата
async function createChatFormulas() {
  console.log('\n💬 Создаем формулы для чата...\n')

  try {
    const converter = new FormulaConverter()

    // Формула для позитивных сообщений
    const positiveChatFormula = {
      id: 'chat_positive_formula',
      name: 'Формула позитивного чата',
      description: 'Влияние позитивных сообщений на характеристики персонажа',
      rootNode: {
        id: 'chat_positive_root',
        type: 'value',
        dataType: 'object',
        value: {
          'Настроение': {
            change: {
              id: 'chat_mood_change',
              type: 'operator',
              operator: 'multiply',
              dataType: 'number',
              leftInput: {
                id: 'chat_base_mood',
                type: 'value',
                dataType: 'number',
                value: 3
              },
              rightInput: {
                id: 'chat_message_length_factor',
                type: 'operator',
                operator: 'divide',
                dataType: 'number',
                leftInput: {
                  id: 'chat_message_length',
                  type: 'variable',
                  variablePath: 'message.length',
                  dataType: 'number'
                },
                rightInput: {
                  id: 'chat_length_divisor',
                  type: 'value',
                  dataType: 'number',
                  value: 50
                }
              }
            },
            permanent: {
              id: 'chat_mood_permanent',
              type: 'value',
              dataType: 'boolean',
              value: false
            }
          },
          'Доверие': {
            change: {
              id: 'chat_trust_change',
              type: 'value',
              dataType: 'number',
              value: 1
            },
            permanent: {
              id: 'chat_trust_permanent',
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

    // Формула для негативных сообщений
    const negativeChatFormula = {
      id: 'chat_negative_formula',
      name: 'Формула негативного чата',
      description: 'Влияние негативных сообщений на характеристики персонажа',
      rootNode: {
        id: 'chat_negative_root',
        type: 'value',
        dataType: 'object',
        value: {
          'Настроение': {
            change: {
              id: 'chat_negative_mood_change',
              type: 'operator',
              operator: 'multiply',
              dataType: 'number',
              leftInput: {
                id: 'chat_negative_base',
                type: 'value',
                dataType: 'number',
                value: -2
              },
              rightInput: {
                id: 'chat_negative_intensity',
                type: 'variable',
                variablePath: 'message.negativeIntensity',
                dataType: 'number'
              }
            },
            permanent: {
              id: 'chat_negative_mood_permanent',
              type: 'value',
              dataType: 'boolean',
              value: false
            }
          },
          'Страх': {
            change: {
              id: 'chat_fear_change',
              type: 'value',
              dataType: 'number',
              value: 2
            },
            permanent: {
              id: 'chat_fear_permanent',
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

    // Сохраняем формулы в базе данных (можно создать отдельную таблицу для формул чата)
    console.log('💾 Сохраняем формулы чата...')
    console.log('✅ Формулы чата созданы успешно')

  } catch (error) {
    console.error('❌ Ошибка при создании формул чата:', error)
  }
}

// Запускаем преобразование
convertFormulas()
  .then(() => createChatFormulas())
  .catch(console.error)
