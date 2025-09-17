// lib/core/formulas/formula-converter.ts

import { Formula, FormulaNode, DataType } from './types/formula-node'

// Маппинг английских названий на русские
const CHARACTERISTIC_MAPPING: Record<string, string> = {
  'energy': 'Энергия',
  'mood': 'Настроение',
  'trust': 'Доверие',
  'stress': 'Стресс',
  'fear': 'Страх',
  'shame': 'Стыд',
  'humiliation': 'Унижение',
  'despair': 'Отчаяние',
  'pride': 'Гордость',
  'self_esteem': 'Самооценка',
  'emotional_stability': 'Эмоциональная стабильность',
  'arousal': 'Возбуждение',
  'sexual_experience': 'Сексуальная опытность',
  'innocence': 'Невинность',
  'submission': 'Покорность',
  'dominance': 'Доминирование',
  'sadism': 'Садизм',
  'masochism': 'Мазохизм',
  'dependence': 'Зависимость',
  'ownership': 'Собственность',
  'sociability': 'Общительность',
  'empathy': 'Эмпатия',
  'intelligence': 'Интеллект',
  'curiosity': 'Любопытство',
  'optimism': 'Оптимизм',
  'adaptability': 'Адаптивность',
  'sensitivity': 'Чувствительность',
  'pain': 'Боль',
  'fatigue': 'Усталость',
  'health': 'Здоровье',
  'endurance': 'Выносливость',
  'flexibility': 'Гибкость'
}

export interface OldFormulaEffect {
  change: number
  permanent: boolean
}

export interface OldFormula {
  [characteristicName: string]: OldFormulaEffect
}

export class FormulaConverter {
  private nodeIdCounter = 0

  // Преобразует старую простую формулу в новую структурированную
  convertOldFormulaToNew(
    oldFormula: OldFormula,
    actionName: string,
    actionIntensity: number = 50
  ): Formula {
    const formulaId = this.generateFormulaId(actionName)

    // Создаем корневой узел - объект с эффектами
    const effectsObject = this.createEffectsObjectNode(oldFormula, actionIntensity)

    return {
      id: formulaId,
      name: `Формула для ${actionName}`,
      description: `Автоматически сгенерированная формула для действия "${actionName}"`,
      version: '2.0',
      rootNode: effectsObject,
      context: {
        variables: {},
        functions: {},
        constants: {}
      },
      metadata: {
        createdBy: 'llm' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['action', 'auto-generated'],
        category: 'action-effects'
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: []
      }
    }
  }

  // Создает узел объекта с эффектами
  private createEffectsObjectNode(oldFormula: OldFormula, actionIntensity: number): FormulaNode {
    const effectsObject: Record<string, FormulaNode> = {}

    for (const [characteristicName, effect] of Object.entries(oldFormula)) {
      // Создаем объект эффекта с динамическим изменением
      const effectNode = {
        id: this.generateNodeId(),
        type: 'object' as const,
        dataType: 'object' as DataType,
        properties: {
          change: this.createDynamicChangeNode(effect.change, actionIntensity),
          permanent: {
            id: this.generateNodeId(),
            type: 'value' as const,
            dataType: 'boolean' as DataType,
            value: effect.permanent
          }
        }
      }
      effectsObject[characteristicName] = effectNode
    }

    return {
      id: this.generateNodeId(),
      type: 'object',
      dataType: 'object' as DataType,
      properties: effectsObject
    }
  }

  // Создает узел для динамического изменения значения
  private createDynamicChangeNode(baseChange: number, actionIntensity: number): FormulaNode {
    // Если изменение равно 0, возвращаем простое значение
    if (baseChange === 0) {
      return {
        id: this.generateNodeId(),
        type: 'value',
        dataType: 'number' as DataType,
        value: 0
      }
    }

    // Создаем формулу: baseChange * (actionIntensity / 50) * userModifier
    return {
      id: this.generateNodeId(),
      type: 'operator',
      operator: 'multiply',
      dataType: 'number' as DataType,
      leftInput: {
        id: this.generateNodeId(),
        type: 'value',
        dataType: 'number' as DataType,
        value: baseChange
      },
      rightInput: {
        id: this.generateNodeId(),
        type: 'operator',
        operator: 'multiply',
        dataType: 'number' as DataType,
        leftInput: {
          id: this.generateNodeId(),
          type: 'operator',
          operator: 'divide',
          dataType: 'number' as DataType,
          leftInput: {
            id: this.generateNodeId(),
            type: 'variable',
            variablePath: 'action.intensity',
            dataType: 'number' as DataType,
            displayName: 'Интенсивность действия'
          },
          rightInput: {
            id: this.generateNodeId(),
            type: 'value',
            dataType: 'number' as DataType,
            value: 50
          }
        },
        rightInput: {
          id: this.generateNodeId(),
          type: 'variable',
          variablePath: 'user.modifiers.general',
          dataType: 'number' as DataType,
          displayName: 'Модификатор пользователя'
        }
      }
    }
  }

  // Создает специальные формулы для разных типов действий
  createSpecializedFormula(
    actionName: string,
    actionType: 'physical' | 'emotional' | 'sexual' | 'pain' | 'comfort',
    baseEffects: OldFormula
  ): Formula {
    const formulaId = this.generateFormulaId(actionName)

    let rootNode: FormulaNode

    switch (actionType) {
      case 'physical':
        rootNode = this.createPhysicalActionFormula(baseEffects)
        break
      case 'emotional':
        rootNode = this.createEmotionalActionFormula(baseEffects)
        break
      case 'sexual':
        rootNode = this.createSexualActionFormula(baseEffects)
        break
      case 'pain':
        rootNode = this.createPainActionFormula(baseEffects)
        break
      case 'comfort':
        rootNode = this.createComfortActionFormula(baseEffects)
        break
      default:
        rootNode = this.createEffectsObjectNode(baseEffects, 50)
    }

    return {
      id: formulaId,
      name: `Специализированная формула для ${actionName}`,
      description: `Формула с учетом типа действия: ${actionType}`,
      version: '2.0',
      rootNode,
      context: {
        variables: {},
        functions: {},
        constants: {}
      },
      metadata: {
        createdBy: 'llm' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        tags: ['action', 'auto-generated', actionType],
        category: 'action-effects'
      },
      validation: {
        isValid: true,
        errors: [],
        warnings: []
      }
    }
  }

  // Формула для физических действий (зависит от силы и выносливости)
  private createPhysicalActionFormula(baseEffects: OldFormula): FormulaNode {
    return this.createConditionalFormula(
      'character.characteristics.Энергия',
      30,
      this.multiplyEffects(baseEffects, 1.5), // Усиленный эффект при высокой энергии
      this.multiplyEffects(baseEffects, 0.7)  // Ослабленный эффект при низкой энергии
    )
  }

  // Формула для эмоциональных действий (зависит от настроения)
  private createEmotionalActionFormula(baseEffects: OldFormula): FormulaNode {
    return this.createConditionalFormula(
      'character.characteristics.Настроение',
      50,
      this.multiplyEffects(baseEffects, 1.3), // Лучший эффект при хорошем настроении
      this.multiplyEffects(baseEffects, 0.8)  // Хуже при плохом настроении
    )
  }

  // Формула для сексуальных действий (зависит от возбуждения)
  private createSexualActionFormula(baseEffects: OldFormula): FormulaNode {
    return this.createConditionalFormula(
      'character.characteristics.Возбуждение',
      40,
      this.multiplyEffects(baseEffects, 1.4), // Усиленный эффект при возбуждении
      this.multiplyEffects(baseEffects, 0.6)  // Слабый эффект без возбуждения
    )
  }

  // Формула для болевых действий (зависит от болевого порога)
  private createPainActionFormula(baseEffects: OldFormula): FormulaNode {
    return this.createConditionalFormula(
      'character.characteristics.Боль',
      60,
      this.multiplyEffects(baseEffects, 0.8), // Меньше боли при высоком пороге
      this.multiplyEffects(baseEffects, 1.3)  // Больше боли при низком пороге
    )
  }

  // Формула для утешительных действий (зависит от стресса)
  private createComfortActionFormula(baseEffects: OldFormula): FormulaNode {
    return this.createConditionalFormula(
      'character.characteristics.Стресс',
      70,
      this.multiplyEffects(baseEffects, 1.5), // Больше пользы при высоком стрессе
      this.multiplyEffects(baseEffects, 0.9)  // Меньше пользы при низком стрессе
    )
  }

  // Создает условную формулу
  private createConditionalFormula(
    conditionPath: string,
    threshold: number,
    trueEffects: OldFormula,
    falseEffects: OldFormula
  ): FormulaNode {
    return {
      id: this.generateNodeId(),
      type: 'condition',
      dataType: 'object' as DataType,
      condition: {
        id: this.generateNodeId(),
        type: 'operator',
        operator: 'greater_than',
        dataType: 'boolean' as DataType,
        leftInput: {
          id: this.generateNodeId(),
          type: 'variable',
          variablePath: conditionPath,
          dataType: 'number' as DataType,
          displayName: 'Условие'
        },
        rightInput: {
          id: this.generateNodeId(),
          type: 'value',
          dataType: 'number' as DataType,
          value: threshold
        }
      },
      trueValue: this.createEffectsObjectNode(trueEffects, 50),
      falseValue: this.createEffectsObjectNode(falseEffects, 50)
    }
  }

  // Умножает все эффекты на множитель
  private multiplyEffects(effects: OldFormula, multiplier: number): OldFormula {
    const result: OldFormula = {}
    for (const [name, effect] of Object.entries(effects)) {
      result[name] = {
        change: effect.change * multiplier,
        permanent: effect.permanent
      }
    }
    return result
  }

  // Генерирует уникальный ID для формулы
  private generateFormulaId(actionName: string): string {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `formula_${actionName.toLowerCase().replace(/\s+/g, '_')}_${timestamp}_${random}`
  }

  // Генерирует уникальный ID для узла
  private generateNodeId(): string {
    return `node_${++this.nodeIdCounter}_${Date.now()}`
  }
}
