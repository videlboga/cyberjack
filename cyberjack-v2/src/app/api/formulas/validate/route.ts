import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db/client'
import { FormulaSystem } from '@/lib/core/formulas/formula-system'
import { FormulaValidator } from '@/lib/core/formulas/formula-validator'

// Получаем список всех доступных переменных для валидации
async function getAvailableVariables() {
  const characteristics = await prisma.characteristicDefinition.findMany({
    select: {
      name: true,
      category: true
    }
  })

  return {
    // Характеристики персонажа
    character: {
      characteristics: characteristics.reduce((acc, char) => {
        acc[char.name] = {
          type: 'number',
          category: char.category,
          description: `Характеристика: ${char.name}`
        }
        return acc
      }, {} as Record<string, any>)
    },

    // Переменные действия
    action: {
      intensity: { type: 'number', description: 'Интенсивность действия' },
      duration: { type: 'number', description: 'Длительность действия' },
      category: { type: 'string', description: 'Категория действия' }
    },

    // Переменные пользователя
    user: {
      modifiers: {
        general: { type: 'number', description: 'Общий модификатор пользователя' },
        physical: { type: 'number', description: 'Модификатор физических действий' },
        emotional: { type: 'number', description: 'Модификатор эмоциональных действий' },
        sexual: { type: 'number', description: 'Модификатор сексуальных действий' }
      },
      credits: { type: 'number', description: 'Кредиты пользователя' }
    },

    // Переменные зоны
    zone: {
      sensitivity: { type: 'number', description: 'Чувствительность зоны' },
      coordinates: {
        x: { type: 'number', description: 'X координата зоны' },
        y: { type: 'number', description: 'Y координата зоны' }
      }
    },

    // Системные переменные
    system: {
      gameTime: { type: 'number', description: 'Игровое время' },
      realTime: { type: 'number', description: 'Реальное время' },
      isActionHolding: { type: 'boolean', description: 'Выполняется ли действие' }
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { formula, context } = body

    if (!formula) {
      return NextResponse.json(
        { error: 'Формула не предоставлена' },
        { status: 400 }
      )
    }

    // Получаем доступные переменные
    const availableVariables = await getAvailableVariables()

    // Создаем валидатор
    const validator = new FormulaValidator({})

    // Создаем контекст для валидации с правильными типами
    const validationContext = {
      character: {
        characteristics: Object.keys(availableVariables.character.characteristics).reduce((acc, key) => {
          acc[key] = 50 // Значение по умолчанию для валидации
          return acc
        }, {} as Record<string, number>)
      },
      action: {
        intensity: 50,
        duration: 5,
        category: 'physical'
      },
      user: {
        modifiers: {
          general: 1.0,
          physical: 1.0,
          emotional: 1.0,
          sexual: 1.0
        },
        credits: 100
      },
      zone: {
        sensitivity: 50,
        coordinates: {
          x: 0,
          y: 0
        }
      },
      system: {
        gameTime: 0,
        realTime: Date.now(),
        isActionHolding: false
      },
      custom: {}
    }

    // Валидируем формулу
    const validation = validator.validateFormula(formula, validationContext)

    // Проверяем переменные в формуле
    const variableErrors: string[] = []
    const usedVariables = extractVariablesFromFormula(formula)

    for (const variablePath of usedVariables) {
      if (!isVariableValid(variablePath, availableVariables)) {
        variableErrors.push(`Переменная '${variablePath}' не найдена в доступных переменных`)
      }
    }

    // Объединяем ошибки
    const allErrors = [
      ...validation.errors.map(e => e.message),
      ...variableErrors
    ]

    return NextResponse.json({
      isValid: validation.isValid && variableErrors.length === 0,
      errors: allErrors,
      warnings: validation.warnings,
      availableVariables,
      usedVariables,
      performance: validation.performance
    })

  } catch (error) {
    console.error('Ошибка валидации формулы:', error)
    return NextResponse.json(
      { error: 'Ошибка валидации формулы' },
      { status: 500 }
    )
  }
}

// Извлекаем все переменные из формулы
function extractVariablesFromFormula(formula: any): string[] {
  const variables: string[] = []

  function traverse(node: any) {
    if (!node) return

    if (node.type === 'variable' && node.variablePath) {
      variables.push(node.variablePath)
    }

    if (node.leftInput) traverse(node.leftInput)
    if (node.rightInput) traverse(node.rightInput)
    if (node.condition) traverse(node.condition)
    if (node.trueValue) traverse(node.trueValue)
    if (node.falseValue) traverse(node.falseValue)
    if (node.parameters && Array.isArray(node.parameters)) {
      node.parameters.forEach(traverse)
    }
  }

  if (formula.rootNode) {
    traverse(formula.rootNode)
  }

  return [...new Set(variables)] // Убираем дубликаты
}

// Проверяем, существует ли переменная в доступных
function isVariableValid(variablePath: string, availableVariables: any): boolean {
  const parts = variablePath.split('.')
  let current = availableVariables

  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part]
    } else {
      return false
    }
  }

  return true
}

// GET запрос для получения списка доступных переменных
export async function GET() {
  try {
    const availableVariables = await getAvailableVariables()

    return NextResponse.json({
      availableVariables,
      categories: {
        character: 'Характеристики персонажа',
        action: 'Параметры действия',
        user: 'Параметры пользователя',
        zone: 'Параметры зоны',
        system: 'Системные параметры'
      }
    })
  } catch (error) {
    console.error('Ошибка получения переменных:', error)
    return NextResponse.json(
      { error: 'Ошибка получения переменных' },
      { status: 500 }
    )
  }
}