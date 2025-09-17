// src/app/api/formulas/execute/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { FormulaSystem } from '../../../../../lib/core/formulas/formula-system'
import { FormulaExecutionContext } from '../../../../../lib/core/formulas/types/formula-context'
import { Formula } from '../../../../../lib/core/formulas/types/formula-node'

const formulaSystem = new FormulaSystem()

export async function POST(request: NextRequest) {
  try {
    const { formula, context, options } = await request.json()

    if (!formula || !context) {
      return NextResponse.json(
        { error: 'Formula and context are required' },
        { status: 400 }
      )
    }

    // Простое выполнение формулы
    const result = executeSimpleFormula(formula, context)

    return NextResponse.json({
      value: result,
      dataType: 'number',
      executionTime: 0,
      factors: [],
      metadata: {
        formulaId: 'simple',
        executedAt: new Date(),
        context: context,
        version: '1.0.0'
      }
    })
  } catch (error) {
    console.error('Error executing formula:', error)
    return NextResponse.json(
      { error: 'Failed to execute formula' },
      { status: 500 }
    )
  }
}

function executeSimpleFormula(formula: string, context: any): number {
  try {
    // Заменяем переменные в формуле на значения из контекста
    let processedFormula = formula

    // Заменяем переменные персонажа
    if (context.character) {
      processedFormula = processedFormula.replace(/character\.mood/g, String(context.character.mood || 50))
      processedFormula = processedFormula.replace(/character\.energy/g, String(context.character.energy || 50))
      processedFormula = processedFormula.replace(/character\.health/g, String(context.character.health || 50))
    }

    // Заменяем переменные действия
    if (context.action) {
      processedFormula = processedFormula.replace(/action\.intensity/g, String(context.action.intensity || 50))
      processedFormula = processedFormula.replace(/action\.duration/g, String(context.action.duration || 30))
      processedFormula = processedFormula.replace(/action\.cost/g, String(context.action.cost || 10))
    }

    // Заменяем переменные пользователя
    if (context.user) {
      processedFormula = processedFormula.replace(/user\.modifiers\.mood/g, String(context.user.modifiers?.mood || 1.0))
      processedFormula = processedFormula.replace(/user\.modifiers\.energy/g, String(context.user.modifiers?.energy || 1.0))
      processedFormula = processedFormula.replace(/user\.modifiers\.sensitivity/g, String(context.user.modifiers?.sensitivity || 1.0))
      processedFormula = processedFormula.replace(/user\.credits/g, String(context.user.credits || 1000))
    }

    // Заменяем переменные зоны
    if (context.zone) {
      processedFormula = processedFormula.replace(/zone\.sensitivity/g, String(context.zone.sensitivity || 50))
      processedFormula = processedFormula.replace(/zone\.area/g, String(context.zone.area || 100))
    }

    // Заменяем системные переменные
    if (context.system) {
      processedFormula = processedFormula.replace(/system\.gameTime/g, String(context.system.gameTime || 0))
      processedFormula = processedFormula.replace(/system\.isActionHolding/g, String(context.system.isActionHolding || false))
    }

    // Заменяем функции
    processedFormula = processedFormula.replace(/min\(([^)]+)\)/g, (match, args) => {
      const values = args.split(',').map((v: string) => parseFloat(v.trim()) || 0)
      return String(Math.min(...values))
    })

    processedFormula = processedFormula.replace(/max\(([^)]+)\)/g, (match, args) => {
      const values = args.split(',').map((v: string) => parseFloat(v.trim()) || 0)
      return String(Math.max(...values))
    })

    processedFormula = processedFormula.replace(/abs\(([^)]+)\)/g, (match, arg) => {
      return String(Math.abs(parseFloat(arg.trim()) || 0))
    })

    processedFormula = processedFormula.replace(/round\(([^)]+)\)/g, (match, arg) => {
      return String(Math.round(parseFloat(arg.trim()) || 0))
    })

    processedFormula = processedFormula.replace(/if\(([^)]+)\)/g, (match, args) => {
      const parts = args.split(',')
      if (parts.length === 3) {
        const condition = parts[0].trim()
        const trueValue = parseFloat(parts[1].trim()) || 0
        const falseValue = parseFloat(parts[2].trim()) || 0

        // Простая проверка условий
        if (condition.includes('>')) {
          const [left, right] = condition.split('>').map((s: string) => parseFloat(s.trim()) || 0)
          return String(left > right ? trueValue : falseValue)
        } else if (condition.includes('<')) {
          const [left, right] = condition.split('<').map((s: string) => parseFloat(s.trim()) || 0)
          return String(left < right ? trueValue : falseValue)
        } else if (condition.includes('>=')) {
          const [left, right] = condition.split('>=').map((s: string) => parseFloat(s.trim()) || 0)
          return String(left >= right ? trueValue : falseValue)
        } else if (condition.includes('<=')) {
          const [left, right] = condition.split('<=').map((s: string) => parseFloat(s.trim()) || 0)
          return String(left <= right ? trueValue : falseValue)
        } else if (condition.includes('==')) {
          const [left, right] = condition.split('==').map((s: string) => parseFloat(s.trim()) || 0)
          return String(left === right ? trueValue : falseValue)
        } else if (condition.includes('!=')) {
          const [left, right] = condition.split('!=').map((s: string) => parseFloat(s.trim()) || 0)
          return String(left !== right ? trueValue : falseValue)
        }
      }
      return '0'
    })

    processedFormula = processedFormula.replace(/random\(([^)]+)\)/g, (match, args) => {
      const parts = args.split(',').map((v: string) => parseFloat(v.trim()) || 0)
      if (parts.length === 2) {
        return String(Math.random() * (parts[1] - parts[0]) + parts[0])
      } else if (parts.length === 1) {
        return String(Math.random() * parts[0])
      }
      return String(Math.random())
    })

    // Выполняем формулу
    const result = eval(processedFormula)
    return typeof result === 'number' ? result : 0
  } catch (error) {
    console.error('Error executing simple formula:', error)
    return 0
  }
}
