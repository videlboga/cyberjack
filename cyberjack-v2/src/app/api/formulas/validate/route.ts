import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { formula } = await request.json()

    if (!formula) {
      return NextResponse.json(
        { error: 'Formula is required' },
        { status: 400 }
      )
    }

    const validation = validateFormula(formula)

    return NextResponse.json(validation)
  } catch (error) {
    console.error('Error validating formula:', error)
    return NextResponse.json(
      { error: 'Failed to validate formula' },
      { status: 500 }
    )
  }
}

function validateFormula(formula: string) {
  const errors: string[] = []
  const warnings: string[] = []

  // Проверка на пустую формулу
  if (!formula.trim()) {
    return { isValid: true, errors: [], warnings: [] }
  }

  // Проверка скобок
  const openParens = (formula.match(/\(/g) || []).length
  const closeParens = (formula.match(/\)/g) || []).length
  if (openParens !== closeParens) {
    errors.push('Несоответствие скобок')
  }

  // Проверка двойных операторов
  if (formula.match(/[+\-*/]{2,}/)) {
    errors.push('Двойные операторы недопустимы')
  }

  // Проверка пустых скобок
  if (formula.match(/\(\s*\)/)) {
    errors.push('Пустые скобки недопустимы')
  }

  // Проверка деления на ноль
  if (formula.includes('/ 0') || formula.includes('/0')) {
    warnings.push('Возможно деление на ноль')
  }

  // Проверка на недопустимые символы
  const invalidChars = formula.match(/[^a-zA-Z0-9\s+\-*/()._,=!<>]/g)
  if (invalidChars) {
    errors.push(`Недопустимые символы: ${invalidChars.join(', ')}`)
  }

  // Проверка на недопустимые функции
  const functionMatches = formula.match(/\b[a-zA-Z_][a-zA-Z0-9_]*\s*\(/g)
  if (functionMatches) {
    const allowedFunctions = ['min', 'max', 'abs', 'round', 'if', 'random']
    functionMatches.forEach(match => {
      const funcName = match.replace(/\s*\(/, '')
      if (!allowedFunctions.includes(funcName.toLowerCase())) {
        errors.push(`Недопустимая функция: ${funcName}`)
      }
    })
  }

  // Проверка на недопустимые операторы
  const operatorMatches = formula.match(/[+\-*/=!<>]+/g)
  if (operatorMatches) {
    const allowedOperators = ['+', '-', '*', '/', '==', '!=', '<', '>', '<=', '>=']
    operatorMatches.forEach(match => {
      if (!allowedOperators.includes(match)) {
        errors.push(`Недопустимый оператор: ${match}`)
      }
    })
  }

  // Проверка на недопустимые переменные
  const variableMatches = formula.match(/\b[a-zA-Z_][a-zA-Z0-9_.]*\b/g)
  if (variableMatches) {
    const allowedVariables = [
      'character.mood', 'character.energy', 'character.health',
      'character.characteristics.mood', 'character.characteristics.energy', 'character.characteristics.health',
      'action.intensity', 'action.duration', 'action.cost',
      'user.modifiers.mood', 'user.modifiers.energy', 'user.modifiers.sensitivity',
      'user.credits',
      'zone.sensitivity', 'zone.area',
      'system.gameTime', 'system.isActionHolding',
      'true', 'false'
    ]
    
    variableMatches.forEach(match => {
      if (!allowedVariables.includes(match) && !['min', 'max', 'abs', 'round', 'if', 'random'].includes(match.toLowerCase())) {
        warnings.push(`Неизвестная переменная: ${match}`)
      }
    })
  }

  // Проверка синтаксиса if функции
  const ifMatches = formula.match(/if\s*\(/g)
  if (ifMatches) {
    ifMatches.forEach(() => {
      // Простая проверка на количество параметров в if
      const ifPattern = /if\s*\([^)]*\)/g
      const matches = formula.match(ifPattern)
      if (matches) {
        matches.forEach(match => {
          const params = match.replace(/if\s*\(/, '').replace(/\)$/, '').split(',')
          if (params.length !== 3) {
            errors.push('Функция if должна иметь ровно 3 параметра: условие, значение_если_да, значение_если_нет')
          }
        })
      }
    })
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}
