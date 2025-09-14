// src/app/api/formulas/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { FormulaSystem } from '../../../../lib/core/formulas/formula-system'
import { FormulaExecutionContext } from '../../../../lib/core/formulas/types/formula-context'

const formulaSystem = new FormulaSystem()

// Получить LLM контекст
export async function GET() {
  try {
    const llmContext = formulaSystem.getLLMContextDescription()
    return NextResponse.json(llmContext)
  } catch (error) {
    console.error('Error getting LLM context:', error)
    return NextResponse.json(
      { error: 'Failed to get LLM context' },
      { status: 500 }
    )
  }
}

// Создать формулу из естественного языка
export async function POST(request: NextRequest) {
  try {
    const { description } = await request.json()

    if (!description) {
      return NextResponse.json(
        { error: 'Description is required' },
        { status: 400 }
      )
    }

    // Простая генерация формулы на основе описания
    const formula = generateSimpleFormula(description)

    return NextResponse.json({
      naturalExpression: formula,
      description: `Сгенерированная формула: ${formula}`,
      confidence: 0.8,
      suggestions: [
        'Проверьте формулу на корректность',
        'Протестируйте с различными значениями',
        'Убедитесь, что все переменные доступны'
      ]
    })
  } catch (error) {
    console.error('Error creating formula:', error)
    return NextResponse.json(
      { error: 'Failed to create formula' },
      { status: 500 }
    )
  }
}

function generateSimpleFormula(description: string): string {
  const lowerDesc = description.toLowerCase()

  // Простые паттерны для генерации формул
  if (lowerDesc.includes('базовый эффект') || lowerDesc.includes('умножь') || lowerDesc.includes('интенсивность')) {
    return '10 * action.intensity / 100'
  }

  if (lowerDesc.includes('условный') || lowerDesc.includes('если') || lowerDesc.includes('настроение')) {
    return 'if(character.mood > 50, 20, 10)'
  }

  if (lowerDesc.includes('модификатор') || lowerDesc.includes('пользователь')) {
    return '10 * action.intensity / 100 * user.modifiers.mood'
  }

  if (lowerDesc.includes('зона') || lowerDesc.includes('чувствительность')) {
    return '10 * action.intensity / 100 * user.modifiers.mood * zone.sensitivity / 100'
  }

  if (lowerDesc.includes('восстановление') || lowerDesc.includes('здоровье')) {
    return 'character.health + (100 - character.health) * 0.1'
  }

  if (lowerDesc.includes('ограниченный') || lowerDesc.includes('максимум')) {
    return 'min(100, character.energy + 10 * action.intensity / 100 * user.modifiers.energy)'
  }

  if (lowerDesc.includes('случайный') || lowerDesc.includes('random')) {
    return '10 + random(0, 5)'
  }

  // По умолчанию возвращаем базовую формулу
  return '10 * action.intensity / 100'
}
