// lib/core/formulas/formula-system.ts

import { FormulaParser } from './formula-parser'
import { FormulaValidator } from './formula-validator'
import { FormulaEngine } from './formula-engine'
import { FormulaTemplates } from './formula-templates'
import {
  Formula,
  FormulaTemplate,
  NaturalLanguageFormula
} from './types/formula-node'
import {
  FormulaExecutionContext,
  FormulaContextSchema,
  LLMContextDescription
} from './types/formula-context'
import {
  FormulaResult,
  FormulaValidationResult,
  LLMFormulaAnalysis
} from './types/formula-result'

export class FormulaSystem {
  private parser: FormulaParser
  private validator: FormulaValidator
  private engine: FormulaEngine
  private templates: FormulaTemplates
  private contextSchema: FormulaContextSchema

  constructor() {
    this.contextSchema = this.buildContextSchema()
    this.parser = new FormulaParser(this.contextSchema)
    this.validator = new FormulaValidator(this.contextSchema)
    this.engine = new FormulaEngine(this.contextSchema)
    this.templates = new FormulaTemplates()
  }

  // Создание формулы из естественного языка (LLM-френдли)
  createFormulaFromNaturalLanguage(
    description: string,
    context?: FormulaExecutionContext
  ): NaturalLanguageFormula | null {
    try {
      // Сначала пробуем найти подходящий шаблон
      const templateResult = this.templates.createFormulaFromNaturalLanguage(description, context)
      if (templateResult && templateResult.confidence > 0.7) {
        return templateResult
      }

      // Если шаблон не подошел, парсим напрямую
      if (context) {
        return this.parser.parseNaturalLanguage(description, context)
      }

      return null
    } catch (error) {
      console.error('Error creating formula from natural language:', error)
      return null
    }
  }

  // Валидация формулы
  validateFormula(
    formula: Formula,
    context?: FormulaExecutionContext
  ): FormulaValidationResult {
    return this.validator.validateFormula(formula, context)
  }

  // Выполнение формулы
  async executeFormula(
    formula: Formula,
    context: FormulaExecutionContext,
    options?: any
  ): Promise<FormulaResult> {
    // Сначала валидируем формулу
    const validation = this.validateFormula(formula, context)
    if (!validation.isValid) {
      throw new Error(`Formula validation failed: ${validation.errors.map(e => e.message).join(', ')}`)
    }

    return this.engine.executeFormula(formula, context, options)
  }

  // Получение шаблонов
  getTemplates(category?: string): FormulaTemplate[] {
    if (category) {
      return this.templates.getTemplatesByCategory(category)
    }
    return this.templates.getAllTemplates()
  }

  // Создание формулы из шаблона
  createFormulaFromTemplate(
    templateId: string,
    variables: Record<string, any>
  ): Formula | null {
    return this.templates.createFormulaFromTemplate(templateId, variables)
  }

  // LLM анализ формулы
  analyzeFormulaForLLM(
    formula: Formula,
    context?: FormulaExecutionContext
  ): LLMFormulaAnalysis {
    const validation = this.validateFormula(formula, context)

    return {
      confidence: this.calculateLLMConfidence(formula, validation),
      interpretation: this.generateInterpretation(formula),
      suggestions: this.generateLLMSuggestions(formula, validation),
      alternativeFormulations: this.generateAlternatives(formula),
      potentialIssues: this.identifyPotentialIssues(formula, validation)
    }
  }

  // Получение LLM-френдли описания контекста
  getLLMContextDescription(): LLMContextDescription {
    return {
      systemPrompt: this.generateSystemPrompt(),
      variableDescriptions: this.generateVariableDescriptions(),
      functionDescriptions: this.generateFunctionDescriptions(),
      operatorDescriptions: this.generateOperatorDescriptions(),
      examples: this.generateExamples(),
      templates: this.generateTemplateDescriptions()
    }
  }

  // Построение схемы контекста
  private buildContextSchema(): FormulaContextSchema {
    return {
      variables: {
        // Характеристики персонажа
        'character.characteristics.mood': {
          path: 'character.characteristics.mood',
          name: 'Настроение персонажа',
          description: 'Текущее значение настроения персонажа (0-100)',
          type: 'number',
          category: 'character',
          accessPath: ['character', 'characteristics', 'mood'],
          validation: { min: 0, max: 100 },
          examples: [50, 75, 100],
          isReadOnly: false
        },
        'character.characteristics.energy': {
          path: 'character.characteristics.energy',
          name: 'Энергия персонажа',
          description: 'Текущее значение энергии персонажа (0-100)',
          type: 'number',
          category: 'character',
          accessPath: ['character', 'characteristics', 'energy'],
          validation: { min: 0, max: 100 },
          examples: [50, 75, 100],
          isReadOnly: false
        },
        'character.characteristics.health': {
          path: 'character.characteristics.health',
          name: 'Здоровье персонажа',
          description: 'Текущее значение здоровья персонажа (0-100)',
          type: 'number',
          category: 'character',
          accessPath: ['character', 'characteristics', 'health'],
          validation: { min: 0, max: 100 },
          examples: [50, 75, 100],
          isReadOnly: false
        },

        // Свойства действия
        'action.intensity': {
          path: 'action.intensity',
          name: 'Интенсивность действия',
          description: 'Интенсивность выполняемого действия (0-100)',
          type: 'number',
          category: 'action',
          accessPath: ['action', 'intensity'],
          validation: { min: 0, max: 100 },
          examples: [25, 50, 75, 100],
          isReadOnly: true
        },
        'action.cost': {
          path: 'action.cost',
          name: 'Стоимость действия',
          description: 'Стоимость действия в кредитах',
          type: 'number',
          category: 'action',
          accessPath: ['action', 'cost'],
          validation: { min: 0 },
          examples: [10, 25, 50],
          isReadOnly: true
        },

        // Модификаторы пользователя
        'user.modifiers.mood': {
          path: 'user.modifiers.mood',
          name: 'Модификатор настроения пользователя',
          description: 'Модификатор влияния пользователя на настроение',
          type: 'number',
          category: 'user',
          accessPath: ['user', 'modifiers', 'mood'],
          validation: { min: 0, max: 2 },
          examples: [0.5, 1.0, 1.5],
          isReadOnly: true
        },
        'user.modifiers.energy': {
          path: 'user.modifiers.energy',
          name: 'Модификатор энергии пользователя',
          description: 'Модификатор влияния пользователя на энергию',
          type: 'number',
          category: 'user',
          accessPath: ['user', 'modifiers', 'energy'],
          validation: { min: 0, max: 2 },
          examples: [0.5, 1.0, 1.5],
          isReadOnly: true
        },

        // Свойства зоны
        'zone.sensitivity': {
          path: 'zone.sensitivity',
          name: 'Чувствительность зоны',
          description: 'Чувствительность активной зоны (0-100)',
          type: 'number',
          category: 'zone',
          accessPath: ['zone', 'sensitivity'],
          validation: { min: 0, max: 100 },
          examples: [25, 50, 75, 100],
          isReadOnly: true
        },

        // Системные значения
        'system.gameTime': {
          path: 'system.gameTime',
          name: 'Игровое время',
          description: 'Текущее игровое время в минутах',
          type: 'number',
          category: 'system',
          accessPath: ['system', 'gameTime'],
          validation: { min: 0 },
          examples: [0, 60, 120, 1440],
          isReadOnly: true
        },
        'system.isActionHolding': {
          path: 'system.isActionHolding',
          name: 'Холд действия',
          description: 'Флаг активного холда действия',
          type: 'boolean',
          category: 'system',
          accessPath: ['system', 'isActionHolding'],
          examples: [true, false],
          isReadOnly: true
        }
      },

      functions: {
        'min': {
          name: 'min',
          description: 'Возвращает минимальное значение из списка',
          parameters: [
            { name: 'values', type: 'array', description: 'Список значений для сравнения', required: true }
          ],
          returnType: 'number',
          examples: [
            { input: [5, 10, 15], output: 5, description: 'Минимальное из 5, 10, 15' }
          ],
          category: 'math'
        },
        'max': {
          name: 'max',
          description: 'Возвращает максимальное значение из списка',
          parameters: [
            { name: 'values', type: 'array', description: 'Список значений для сравнения', required: true }
          ],
          returnType: 'number',
          examples: [
            { input: [5, 10, 15], output: 15, description: 'Максимальное из 5, 10, 15' }
          ],
          category: 'math'
        },
        'abs': {
          name: 'abs',
          description: 'Возвращает абсолютное значение числа',
          parameters: [
            { name: 'value', type: 'number', description: 'Число для получения абсолютного значения', required: true }
          ],
          returnType: 'number',
          examples: [
            { input: [-10], output: 10, description: 'Абсолютное значение -10' }
          ],
          category: 'math'
        },
        'if': {
          name: 'if',
          description: 'Условная функция: если условие истинно, возвращает первое значение, иначе второе',
          parameters: [
            { name: 'condition', type: 'boolean', description: 'Условие для проверки', required: true },
            { name: 'trueValue', type: 'number', description: 'Значение при истинном условии', required: true },
            { name: 'falseValue', type: 'number', description: 'Значение при ложном условии', required: true }
          ],
          returnType: 'number',
          examples: [
            { input: [true, 10, 5], output: 10, description: 'Если true, то 10, иначе 5' }
          ],
          category: 'conditional'
        }
      },

      operators: {
        'add': {
          name: 'add',
          symbol: '+',
          description: 'Сложение двух чисел',
          leftType: 'number',
          rightType: 'number',
          returnType: 'number',
          precedence: 1,
          associativity: 'left',
          examples: [
            { left: 5, right: 3, result: 8, description: '5 + 3 = 8' }
          ]
        },
        'multiply': {
          name: 'multiply',
          symbol: '*',
          description: 'Умножение двух чисел',
          leftType: 'number',
          rightType: 'number',
          returnType: 'number',
          precedence: 2,
          associativity: 'left',
          examples: [
            { left: 5, right: 3, result: 15, description: '5 * 3 = 15' }
          ]
        }
      }
    }
  }

  // Генерация системного промпта для LLM
  private generateSystemPrompt(): string {
    return `Ты - эксперт по созданию формул для игровой системы CyberJack v2.0.

Твоя задача - создавать формулы на естественном языке, которые будут автоматически преобразованы в структурированные формулы.

ДОСТУПНЫЕ ПЕРЕМЕННЫЕ:
${Object.values(this.contextSchema.variables).map(v => `- ${v.path}: ${v.description}`).join('\n')}

ДОСТУПНЫЕ ФУНКЦИИ:
${Object.values(this.contextSchema.functions).map(f => `- ${f.name}(): ${f.description}`).join('\n')}

ДОСТУПНЫЕ ОПЕРАТОРЫ:
${Object.values(this.contextSchema.operators).map(o => `- ${o.symbol}: ${o.description}`).join('\n')}

ПРАВИЛА:
1. Используй понятные и описательные названия
2. Указывай единицы измерения где применимо
3. Объясняй логику формулы
4. Предлагай альтернативные варианты если возможно

ПРИМЕРЫ:
- "Умножь базовое значение 10 на интенсивность действия"
- "Если настроение больше 50, примени усиленный эффект 20, иначе обычный 10"
- "Восстанови характеристику к базовому значению со скоростью 0.5"`
  }

  // Генерация описаний переменных
  private generateVariableDescriptions(): Record<string, string> {
    const descriptions: Record<string, string> = {}

    Object.entries(this.contextSchema.variables).forEach(([path, variable]) => {
      descriptions[path] = `${variable.description} (${variable.type}, ${variable.category})`
    })

    return descriptions
  }

  // Генерация описаний функций
  private generateFunctionDescriptions(): Record<string, string> {
    const descriptions: Record<string, string> = {}

    Object.entries(this.contextSchema.functions).forEach(([name, func]) => {
      descriptions[name] = `${func.description} (возвращает: ${func.returnType})`
    })

    return descriptions
  }

  // Генерация описаний операторов
  private generateOperatorDescriptions(): Record<string, string> {
    const descriptions: Record<string, string> = {}

    Object.entries(this.contextSchema.operators).forEach(([name, op]) => {
      descriptions[name] = `${op.description} (${op.leftType} ${op.symbol} ${op.rightType} = ${op.returnType})`
    })

    return descriptions
  }

  // Генерация примеров
  private generateExamples(): Array<{ naturalLanguage: string; structuredFormula: any; explanation: string }> {
    return [
      {
        naturalLanguage: 'Умножь базовое значение 10 на интенсивность действия',
        structuredFormula: { type: 'operator', operator: 'multiply', left: 10, right: 'action.intensity' },
        explanation: 'Простое умножение базового значения на интенсивность действия'
      },
      {
        naturalLanguage: 'Если настроение больше 50, примени эффект 20, иначе 10',
        structuredFormula: { type: 'function', name: 'if', params: ['character.mood > 50', 20, 10] },
        explanation: 'Условная логика с проверкой значения характеристики'
      }
    ]
  }

  // Генерация описаний шаблонов
  private generateTemplateDescriptions(): Array<{ name: string; pattern: string; description: string; example: string }> {
    return this.templates.getAllTemplates().map(template => ({
      name: template.name,
      pattern: template.naturalTemplate,
      description: template.description,
      example: template.examples[0]?.name || 'No example'
    }))
  }

  // Расчет уверенности LLM
  private calculateLLMConfidence(formula: Formula, validation: FormulaValidationResult): number {
    let confidence = 0.5

    if (validation.isValid) confidence += 0.3
    if (validation.errors.length === 0) confidence += 0.2
    if (validation.warnings.length === 0) confidence += 0.1

    return Math.min(confidence, 1.0)
  }

  // Генерация интерпретации
  private generateInterpretation(formula: Formula): string {
    return `Формула "${formula.name}": ${formula.description || 'Без описания'}`
  }

  // Генерация предложений для LLM
  private generateLLMSuggestions(formula: Formula, validation: FormulaValidationResult): string[] {
    const suggestions: string[] = []

    if (validation.errors.length > 0) {
      suggestions.push('Исправьте ошибки валидации перед использованием формулы')
    }

    if (validation.warnings.length > 0) {
      suggestions.push('Рассмотрите предупреждения для улучшения формулы')
    }

    suggestions.push('Протестируйте формулу с различными входными данными')

    return suggestions
  }

  // Генерация альтернатив
  private generateAlternatives(formula: Formula): Array<{ naturalLanguage: string; confidence: number; reasoning: string }> {
    return [
      {
        naturalLanguage: `Альтернативная формула для ${formula.name}`,
        confidence: 0.7,
        reasoning: 'Упрощенная версия с аналогичной логикой'
      }
    ]
  }

  // Выявление потенциальных проблем
  private identifyPotentialIssues(formula: Formula, validation: FormulaValidationResult): Array<{ issue: string; severity: 'low' | 'medium' | 'high'; suggestion: string }> {
    const issues: Array<{ issue: string; severity: 'low' | 'medium' | 'high'; suggestion: string }> = []

    if (validation.errors.length > 0) {
      issues.push({
        issue: 'Ошибки валидации',
        severity: 'high',
        suggestion: 'Исправьте все ошибки перед использованием'
      })
    }

    if (validation.warnings.length > 0) {
      issues.push({
        issue: 'Предупреждения валидации',
        severity: 'medium',
        suggestion: 'Рассмотрите предупреждения для улучшения'
      })
    }

    return issues
  }
}
