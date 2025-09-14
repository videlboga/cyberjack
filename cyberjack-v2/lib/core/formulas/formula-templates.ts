// lib/core/formulas/formula-templates.ts

import { Formula, FormulaNode, FormulaTemplate, NaturalLanguageFormula } from './types/formula-node'
import { FormulaExecutionContext } from './types/formula-context'

export class FormulaTemplates {
  private templates: Map<string, FormulaTemplate> = new Map()

  constructor() {
    this.initializeTemplates()
  }

  // Получить шаблон по ID
  getTemplate(templateId: string): FormulaTemplate | undefined {
    return this.templates.get(templateId)
  }

  // Получить все шаблоны
  getAllTemplates(): FormulaTemplate[] {
    return Array.from(this.templates.values())
  }

  // Получить шаблоны по категории
  getTemplatesByCategory(category: string): FormulaTemplate[] {
    return this.getAllTemplates().filter(template => template.category === category)
  }

  // Создать формулу из шаблона
  createFormulaFromTemplate(
    templateId: string,
    variables: Record<string, any>
  ): Formula | null {
    const template = this.getTemplate(templateId)
    if (!template) {
      return null
    }

    // Заменяем переменные в шаблоне
    const formula = this.replaceVariables(template.structuredTemplate, variables)

    return {
      ...formula,
      id: this.generateId(),
      name: `Generated from ${template.name}`,
      metadata: {
        ...formula.metadata,
        createdBy: 'llm',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: [...formula.metadata.tags, 'template-generated']
      }
    }
  }

  // LLM-френдли создание формулы
  createFormulaFromNaturalLanguage(
    description: string,
    context?: FormulaExecutionContext
  ): NaturalLanguageFormula | null {
    // Анализируем описание и подбираем подходящий шаблон
    const template = this.findBestTemplate(description)
    if (!template) {
      return null
    }

    // Извлекаем переменные из описания
    const variables = this.extractVariablesFromDescription(description, template)

    // Создаем формулу
    const formula = this.createFormulaFromTemplate(template.id, variables)
    if (!formula) {
      return null
    }

    return {
      id: this.generateId(),
      name: this.extractName(description),
      description,
      naturalExpression: description,
      structuredFormula: formula,
      confidence: this.calculateConfidence(description, template, variables),
      suggestions: this.generateSuggestions(description, template)
    }
  }

  // Инициализация шаблонов
  private initializeTemplates(): void {
    // Шаблоны для эффектов действий
    this.addTemplate({
      id: 'action_effect_basic',
      name: 'Базовый эффект действия',
      description: 'Простое умножение базового эффекта на интенсивность действия',
      category: 'action_effects',
      naturalTemplate: 'Умножь базовое значение на интенсивность действия',
      structuredTemplate: this.createBasicActionEffectTemplate(),
      variables: [
        {
          name: 'baseValue',
          type: 'number',
          description: 'Базовое значение эффекта',
          required: true,
          examples: [10, 15, 20]
        }
      ],
      examples: [
        {
          name: 'Увеличение настроения',
          description: 'Увеличить настроение на 10 единиц с учетом интенсивности',
          input: { baseValue: 10 },
          expectedOutput: '10 * action.intensity / 100',
          passed: true
        }
      ],
      llmPrompt: 'Создай формулу для эффекта действия, где базовое значение умножается на интенсивность действия (0-100)'
    })

    // Шаблоны для модификаторов пользователя
    this.addTemplate({
      id: 'user_modifier_effect',
      name: 'Эффект с модификатором пользователя',
      description: 'Эффект с учетом модификаторов пользователя',
      category: 'user_effects',
      naturalTemplate: 'Умножь базовое значение на интенсивность действия и модификатор пользователя',
      structuredTemplate: this.createUserModifierTemplate(),
      variables: [
        {
          name: 'baseValue',
          type: 'number',
          description: 'Базовое значение эффекта',
          required: true,
          examples: [10, 15, 20]
        },
        {
          name: 'modifierKey',
          type: 'string',
          description: 'Ключ модификатора пользователя',
          required: true,
          examples: ['mood', 'energy', 'sensitivity']
        }
      ],
      examples: [
        {
          name: 'Эффект с модификатором настроения',
          description: 'Эффект с учетом модификатора настроения пользователя',
          input: { baseValue: 10, modifierKey: 'mood' },
          expectedOutput: '10 * action.intensity / 100 * user.modifiers.mood',
          passed: true
        }
      ],
      llmPrompt: 'Создай формулу для эффекта действия с учетом модификаторов пользователя'
    })

    // Шаблоны для зон
    this.addTemplate({
      id: 'zone_sensitivity_effect',
      name: 'Эффект с чувствительностью зоны',
      description: 'Эффект с учетом чувствительности активной зоны',
      category: 'zone_effects',
      naturalTemplate: 'Умножь базовое значение на интенсивность действия, модификатор пользователя и чувствительность зоны',
      structuredTemplate: this.createZoneSensitivityTemplate(),
      variables: [
        {
          name: 'baseValue',
          type: 'number',
          description: 'Базовое значение эффекта',
          required: true,
          examples: [10, 15, 20]
        },
        {
          name: 'modifierKey',
          type: 'string',
          description: 'Ключ модификатора пользователя',
          required: true,
          examples: ['mood', 'energy', 'sensitivity']
        }
      ],
      examples: [
        {
          name: 'Эффект с чувствительностью зоны',
          description: 'Эффект с учетом чувствительности зоны',
          input: { baseValue: 10, modifierKey: 'mood' },
          expectedOutput: '10 * action.intensity / 100 * user.modifiers.mood * zone.sensitivity / 100',
          passed: true
        }
      ],
      llmPrompt: 'Создай формулу для эффекта действия с учетом чувствительности активной зоны'
    })

    // Шаблоны для условных эффектов
    this.addTemplate({
      id: 'conditional_effect',
      name: 'Условный эффект',
      description: 'Эффект, зависящий от условий',
      category: 'conditional_effects',
      naturalTemplate: 'Если характеристика больше порога, то примени усиленный эффект, иначе обычный',
      structuredTemplate: this.createConditionalEffectTemplate(),
      variables: [
        {
          name: 'characteristicKey',
          type: 'string',
          description: 'Ключ характеристики для проверки',
          required: true,
          examples: ['mood', 'energy', 'health']
        },
        {
          name: 'threshold',
          type: 'number',
          description: 'Пороговое значение',
          required: true,
          examples: [50, 75, 100]
        },
        {
          name: 'normalValue',
          type: 'number',
          description: 'Обычное значение эффекта',
          required: true,
          examples: [5, 10, 15]
        },
        {
          name: 'enhancedValue',
          type: 'number',
          description: 'Усиленное значение эффекта',
          required: true,
          examples: [10, 20, 30]
        }
      ],
      examples: [
        {
          name: 'Условное увеличение настроения',
          description: 'Если настроение больше 50, увеличить на 20, иначе на 10',
          input: {
            characteristicKey: 'mood',
            threshold: 50,
            normalValue: 10,
            enhancedValue: 20
          },
          expectedOutput: 'IF(character.mood > 50, 20, 10)',
          passed: true
        }
      ],
      llmPrompt: 'Создай формулу с условием: если характеристика больше порога, примени один эффект, иначе другой'
    })

    // Шаблоны для восстановления
    this.addTemplate({
      id: 'characteristic_recovery',
      name: 'Восстановление характеристики',
      description: 'Формула восстановления характеристики к базовому значению',
      category: 'recovery',
      naturalTemplate: 'Восстанови характеристику к базовому значению со скоростью восстановления',
      structuredTemplate: this.createRecoveryTemplate(),
      variables: [
        {
          name: 'recoveryRate',
          type: 'number',
          description: 'Скорость восстановления',
          required: true,
          examples: [0.1, 0.5, 1.0]
        }
      ],
      examples: [
        {
          name: 'Восстановление настроения',
          description: 'Восстановление настроения со скоростью 0.5',
          input: { recoveryRate: 0.5 },
          expectedOutput: 'SIGN(baseValue - currentValue) * MIN(ABS(baseValue - currentValue), 0.5)',
          passed: true
        }
      ],
      llmPrompt: 'Создай формулу восстановления характеристики к базовому значению'
    })
  }

  // Создание базового шаблона эффекта действия
  private createBasicActionEffectTemplate(): Formula {
    return {
      id: 'template_basic_action_effect',
      name: 'Basic Action Effect',
      description: 'Basic action effect template',
      version: '1.0.0',
      rootNode: {
        id: 'root',
        type: 'operator',
        operator: 'multiply',
        dataType: 'number',
        leftInput: {
          id: 'base_value',
          type: 'value',
          dataType: 'number',
          value: 10
        },
        rightInput: {
          id: 'intensity_modifier',
          type: 'operator',
          operator: 'divide',
          dataType: 'number',
          leftInput: {
            id: 'action_intensity',
            type: 'variable',
            variablePath: 'action.intensity',
            displayName: 'Action Intensity',
            dataType: 'number'
          },
          rightInput: {
            id: 'hundred',
            type: 'value',
            dataType: 'number',
            value: 100
          }
        }
      },
      context: {
        requiredVariables: ['action.intensity'],
        optionalVariables: [],
        returnType: 'number',
        description: 'Basic action effect calculation',
        examples: []
      },
      metadata: {
        createdBy: 'template',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['template', 'action', 'effect'],
        category: 'action_effects'
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: []
      }
    }
  }

  // Создание шаблона с модификатором пользователя
  private createUserModifierTemplate(): Formula {
    return {
      id: 'template_user_modifier_effect',
      name: 'User Modifier Effect',
      description: 'Action effect with user modifier',
      version: '1.0.0',
      rootNode: {
        id: 'root',
        type: 'operator',
        operator: 'multiply',
        dataType: 'number',
        leftInput: {
          id: 'base_effect',
          type: 'operator',
          operator: 'multiply',
          dataType: 'number',
          leftInput: {
            id: 'base_value',
            type: 'value',
            dataType: 'number',
            value: 10
          },
          rightInput: {
            id: 'intensity_modifier',
            type: 'operator',
            operator: 'divide',
            dataType: 'number',
            leftInput: {
              id: 'action_intensity',
              type: 'variable',
              variablePath: 'action.intensity',
              displayName: 'Action Intensity',
              dataType: 'number'
            },
            rightInput: {
              id: 'hundred',
              type: 'value',
              dataType: 'number',
              value: 100
            }
          }
        },
        rightInput: {
          id: 'user_modifier',
          type: 'variable',
          variablePath: 'user.modifiers.mood',
          displayName: 'User Modifier',
          dataType: 'number'
        }
      },
      context: {
        requiredVariables: ['action.intensity', 'user.modifiers.mood'],
        optionalVariables: [],
        returnType: 'number',
        description: 'Action effect with user modifier',
        examples: []
      },
      metadata: {
        createdBy: 'template',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['template', 'action', 'effect', 'user'],
        category: 'user_effects'
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: []
      }
    }
  }

  // Создание шаблона с чувствительностью зоны
  private createZoneSensitivityTemplate(): Formula {
    return {
      id: 'template_zone_sensitivity_effect',
      name: 'Zone Sensitivity Effect',
      description: 'Action effect with zone sensitivity',
      version: '1.0.0',
      rootNode: {
        id: 'root',
        type: 'operator',
        operator: 'multiply',
        dataType: 'number',
        leftInput: {
          id: 'base_effect_with_user',
          type: 'operator',
          operator: 'multiply',
          dataType: 'number',
          leftInput: {
            id: 'base_effect',
            type: 'operator',
            operator: 'multiply',
            dataType: 'number',
            leftInput: {
              id: 'base_value',
              type: 'value',
              dataType: 'number',
              value: 10
            },
            rightInput: {
              id: 'intensity_modifier',
              type: 'operator',
              operator: 'divide',
              dataType: 'number',
              leftInput: {
                id: 'action_intensity',
                type: 'variable',
                variablePath: 'action.intensity',
                displayName: 'Action Intensity',
                dataType: 'number'
              },
              rightInput: {
                id: 'hundred',
                type: 'value',
                dataType: 'number',
                value: 100
              }
            }
          },
          rightInput: {
            id: 'user_modifier',
            type: 'variable',
            variablePath: 'user.modifiers.mood',
            displayName: 'User Modifier',
            dataType: 'number'
          }
        },
        rightInput: {
          id: 'zone_sensitivity',
          type: 'operator',
          operator: 'divide',
          dataType: 'number',
          leftInput: {
            id: 'zone_sensitivity_value',
            type: 'variable',
            variablePath: 'zone.sensitivity',
            displayName: 'Zone Sensitivity',
            dataType: 'number'
          },
          rightInput: {
            id: 'hundred_2',
            type: 'value',
            dataType: 'number',
            value: 100
          }
        }
      },
      context: {
        requiredVariables: ['action.intensity', 'user.modifiers.mood', 'zone.sensitivity'],
        optionalVariables: [],
        returnType: 'number',
        description: 'Action effect with zone sensitivity',
        examples: []
      },
      metadata: {
        createdBy: 'template',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['template', 'action', 'effect', 'zone'],
        category: 'zone_effects'
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: []
      }
    }
  }

  // Создание шаблона условного эффекта
  private createConditionalEffectTemplate(): Formula {
    return {
      id: 'template_conditional_effect',
      name: 'Conditional Effect',
      description: 'Conditional effect based on character state',
      version: '1.0.0',
      rootNode: {
        id: 'root',
        type: 'function',
        functionName: 'if',
        dataType: 'number',
        parameters: [
          {
            id: 'condition',
            type: 'operator',
            operator: 'greater_than',
            dataType: 'boolean',
            leftInput: {
              id: 'character_mood',
              type: 'variable',
              variablePath: 'character.mood',
              displayName: 'Character Mood',
              dataType: 'number'
            },
            rightInput: {
              id: 'threshold',
              type: 'value',
              dataType: 'number',
              value: 50
            }
          },
          {
            id: 'enhanced_value',
            type: 'value',
            dataType: 'number',
            value: 20
          },
          {
            id: 'normal_value',
            type: 'value',
            dataType: 'number',
            value: 10
          }
        ]
      },
      context: {
        requiredVariables: ['character.mood'],
        optionalVariables: [],
        returnType: 'number',
        description: 'Conditional effect based on character state',
        examples: []
      },
      metadata: {
        createdBy: 'template',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['template', 'conditional', 'effect'],
        category: 'conditional_effects'
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: []
      }
    }
  }

  // Создание шаблона восстановления
  private createRecoveryTemplate(): Formula {
    return {
      id: 'template_recovery',
      name: 'Characteristic Recovery',
      description: 'Recovery formula for characteristics',
      version: '1.0.0',
      rootNode: {
        id: 'root',
        type: 'operator',
        operator: 'multiply',
        dataType: 'number',
        leftInput: {
          id: 'sign',
          type: 'function',
          functionName: 'abs',
          dataType: 'number',
          parameters: [
            {
              id: 'difference',
              type: 'operator',
              operator: 'subtract',
              dataType: 'number',
              leftInput: {
                id: 'base_value',
                type: 'variable',
                variablePath: 'character.baseValue',
                displayName: 'Base Value',
                dataType: 'number'
              },
              rightInput: {
                id: 'current_value',
                type: 'variable',
                variablePath: 'character.currentValue',
                displayName: 'Current Value',
                dataType: 'number'
              }
            }
          ]
        },
        rightInput: {
          id: 'recovery_amount',
          type: 'function',
          functionName: 'min',
          dataType: 'number',
          parameters: [
            {
              id: 'abs_difference',
              type: 'function',
              functionName: 'abs',
              dataType: 'number',
              parameters: [
                {
                  id: 'difference_2',
                  type: 'operator',
                  operator: 'subtract',
                  dataType: 'number',
                  leftInput: {
                    id: 'base_value_2',
                    type: 'variable',
                    variablePath: 'character.baseValue',
                    displayName: 'Base Value',
                    dataType: 'number'
                  },
                  rightInput: {
                    id: 'current_value_2',
                    type: 'variable',
                    variablePath: 'character.currentValue',
                    displayName: 'Current Value',
                    dataType: 'number'
                  }
                }
              ]
            },
            {
              id: 'recovery_rate',
              type: 'value',
              dataType: 'number',
              value: 0.5
            }
          ]
        }
      },
      context: {
        requiredVariables: ['character.baseValue', 'character.currentValue'],
        optionalVariables: [],
        returnType: 'number',
        description: 'Recovery formula for characteristics',
        examples: []
      },
      metadata: {
        createdBy: 'template',
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['template', 'recovery'],
        category: 'recovery'
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: []
      }
    }
  }

  // Добавление шаблона
  private addTemplate(template: FormulaTemplate): void {
    this.templates.set(template.id, template)
  }

  // Поиск лучшего шаблона
  private findBestTemplate(description: string): FormulaTemplate | null {
    const lowerDescription = description.toLowerCase()

    // Простая эвристика для поиска подходящего шаблона
    for (const template of this.templates.values()) {
      const score = this.calculateTemplateScore(lowerDescription, template)
      if (score > 0.5) {
        return template
      }
    }

    return null
  }

  // Расчет соответствия шаблона
  private calculateTemplateScore(description: string, template: FormulaTemplate): number {
    let score = 0

    // Проверяем ключевые слова
    const keywords = template.name.toLowerCase().split(' ')
    keywords.forEach(keyword => {
      if (description.includes(keyword)) {
        score += 0.2
      }
    })

    // Проверяем описание
    const templateDesc = template.description.toLowerCase()
    if (description.includes(templateDesc)) {
      score += 0.3
    }

    return Math.min(score, 1.0)
  }

  // Извлечение переменных из описания
  private extractVariablesFromDescription(description: string, template: FormulaTemplate): Record<string, any> {
    const variables: Record<string, any> = {}

    // Простое извлечение чисел
    const numbers = description.match(/\d+/g)
    if (numbers) {
      const numberValues = numbers.map(n => parseInt(n))
      template.variables.forEach((variable, index) => {
        if (variable.type === 'number' && numberValues[index]) {
          variables[variable.name] = numberValues[index]
        }
      })
    }

    // Простое извлечение строк
    const strings = description.match(/"([^"]+)"/g)
    if (strings) {
      const stringValues = strings.map(s => s.slice(1, -1))
      template.variables.forEach((variable, index) => {
        if (variable.type === 'string' && stringValues[index]) {
          variables[variable.name] = stringValues[index]
        }
      })
    }

    return variables
  }

  // Замена переменных в формуле
  private replaceVariables(formula: Formula, variables: Record<string, any>): Formula {
    // Глубокое клонирование формулы
    const clonedFormula = JSON.parse(JSON.stringify(formula))

    // Заменяем переменные в узлах
    this.replaceVariablesInNode(clonedFormula.rootNode, variables)

    return clonedFormula
  }

  // Замена переменных в узле
  private replaceVariablesInNode(node: FormulaNode, variables: Record<string, any>): void {
    if (node.type === 'value' && variables[node.id]) {
      node.value = variables[node.id]
    }

    if (node.type === 'operator') {
      this.replaceVariablesInNode(node.leftInput, variables)
      this.replaceVariablesInNode(node.rightInput, variables)
    }

    if (node.type === 'function') {
      node.parameters.forEach(param => {
        this.replaceVariablesInNode(param, variables)
      })
    }

    if (node.type === 'condition') {
      this.replaceVariablesInNode(node.condition, variables)
      this.replaceVariablesInNode(node.trueValue, variables)
      this.replaceVariablesInNode(node.falseValue, variables)
    }
  }

  // Расчет уверенности
  private calculateConfidence(description: string, template: FormulaTemplate, variables: Record<string, any>): number {
    let confidence = 0.5

    // Проверяем заполненность переменных
    const requiredVars = template.variables.filter(v => v.required)
    const filledVars = requiredVars.filter(v => variables[v.name] !== undefined)
    confidence += (filledVars.length / requiredVars.length) * 0.3

    // Проверяем соответствие описания
    if (description.toLowerCase().includes(template.name.toLowerCase())) {
      confidence += 0.2
    }

    return Math.min(confidence, 1.0)
  }

  // Генерация предложений
  private generateSuggestions(description: string, template: FormulaTemplate): string[] {
    const suggestions: string[] = []

    suggestions.push(`Использован шаблон: ${template.name}`)
    suggestions.push(`Категория: ${template.category}`)

    if (template.variables.length > 0) {
      suggestions.push('Доступные переменные:')
      template.variables.forEach(variable => {
        suggestions.push(`- ${variable.name}: ${variable.description}`)
      })
    }

    return suggestions
  }

  // Извлечение имени
  private extractName(description: string): string {
    const lines = description.split('\n')
    const firstLine = lines[0]

    if (firstLine.includes(':')) {
      return firstLine.split(':')[0].trim()
    }

    return 'Generated Formula'
  }

  // Генерация ID
  private generateId(): string {
    return `formula_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}
