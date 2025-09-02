import { Character, CharacterPrompts, SituationalPrompt, PromptCondition, CharacteristicInterpretations, CharacterAttributes } from '../unified-entities'

/**
 * Система управления промтами для персонажей
 */
export class PromptSystem {
  /**
   * Получить все активные промты для персонажа в текущей ситуации
   */
  static getActivePrompts(
    character: Character,
    context: {
      userAction?: string
      emotionalState?: string
      triggeredFetishes?: string[]
      currentStats?: any
    } = {}
  ): {
    base: string
    characteristicInterpretations: string
    situational: SituationalPrompt[]
    combined: string
  } {
    const base = character.prompts?.base || this.getDefaultBasePrompt(character)
    const characteristicInterpretations = this.formatCharacteristicInterpretations(character)
    const situational = this.getMatchingSituationalPrompts(character, context)

    const combined = this.combinePrompts(base, characteristicInterpretations, situational, context)

    return {
      base,
      characteristicInterpretations,
      situational,
      combined
    }
  }

  /**
   * Получить промты по умолчанию для персонажа
   */
  static getDefaultPrompts(character: any): CharacterPrompts {
    return {
      base: this.getDefaultBasePrompt(character),
      characteristicInterpretations: this.getDefaultCharacteristicInterpretations(),
      situational: this.getDefaultSituationalPrompts()
    }
  }

  /**
   * Базовый промт по умолчанию
   */
  private static getDefaultBasePrompt(character: any): string {
    return `Ты - ${character.name}, ${character.archetype}.

ОПИСАНИЕ ПЕРСОНАЖА:
${character.description || 'Описание персонажа'}

СТИЛЬ ОБЩЕНИЯ:
- Используй естественный, живой язык
- Отвечай от первого лица
- Проявляй эмоции и характер
- Учитывай свой архетип и особенности личности

ОСНОВНЫЕ ПРИНЦИПЫ:
- Будь последовательным в характере
- Реагируй на действия пользователя
- Проявляй индивидуальность
- Используй свой стиль общения

Длина ответов: 2-4 предложения`
  }

  /**
   * Интерпретации характеристик по умолчанию
   */
  private static getDefaultCharacteristicInterpretations(): CharacteristicInterpretations {
    // Пытаемся собрать интерпретации из единого system-unified.json
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const systemV2 = require('../../data/system-unified.json')

      const map: CharacteristicInterpretations = {
        physical: {},
        psychological: {},
        social: {},
        personality: {},
        special: {}
      }

      const categoryMap: Record<string, keyof CharacteristicInterpretations> = {
        physical: 'physical',
        psychological: 'psychological',
        social: 'social',
        personality: 'personality',
        special: 'special',
        body_sensitivity: 'physical' // чувствительность частей тела → физические
      }

      const attributes = (systemV2?.attributes || []) as Array<{ id: string; name?: string; category?: string }>
      attributes.forEach(attr => {
        const cat = attr.category && categoryMap[attr.category] ? categoryMap[attr.category] : undefined
        const keyName = attr.name || attr.id
        if (cat && keyName) {
          // Базовая интерпретация, если детальные диапазоны не заданы в v2
          map[cat][keyName] = `${keyName}: влияет на поведение и реакции в сценах`
        }
      })

      return map
    } catch {
      // Фоллбэк на прежний статический набор
      return {
        physical: {
          'Выносливость': 'Выносливость влияет на способность выдерживать длительные нагрузки и стресс',
          'Чувствительность': 'Чувствительность определяет реакцию на физические стимулы и прикосновения',
          'Гибкость': 'Гибкость влияет на адаптивность к новым ситуациям и физическим нагрузкам'
        },
        psychological: {
          'Эмоциональная стабильность': 'Эмоциональная стабильность определяет устойчивость к стрессу и перепадам настроения',
          'Адаптивность': 'Адаптивность влияет на способность приспосабливаться к новым условиям',
          'Интеллект': 'Интеллект определяет глубину понимания и способность к анализу'
        },
        social: {
          'Общительность': 'Общительность влияет на желание взаимодействовать с другими',
          'Эмпатия': 'Эмпатия определяет способность понимать чувства других',
          'Доминантность': 'Доминантность влияет на стремление к лидерству и контролю'
        },
        personality: {
          'Самооценка': 'Самооценка влияет на уверенность в себе и своих действиях',
          'Оптимизм': 'Оптимизм определяет общий настрой и отношение к ситуациям',
          'Любопытство': 'Любопытство влияет на интерес к новому и желание исследовать'
        },
        special: {
          'Сексуальная опытность': 'Сексуальная опытность влияет на уверенность в интимных ситуациях',
          'Сопротивляемость': 'Сопротивляемость определяет способность противостоять давлению',
          'Зависимость': 'Зависимость влияет на потребность в поддержке и одобрении',
          'Чувствительность к фетишам': 'Чувствительность к фетишам определяет реакцию на специфические стимулы',
          'Готовность открывать фетиши': 'Готовность открывать фетиши влияет на исследование новых ощущений'
        }
      }
    }
  }

  /**
   * Ситуативные промты по умолчанию
   */
  private static getDefaultSituationalPrompts(): SituationalPrompt[] {
    return [
      {
        id: 'high_arousal',
        name: 'Высокое возбуждение',
        description: 'Активируется при высоком уровне возбуждения',
        conditions: [
          {
            type: 'parameter_combination',
            parameters: [
              { stat: 'fetishSensitivity', operator: 'gte', value: 7 }
            ],
            emotionalState: ['возбужденный', 'взволнованный']
          }
        ],
        prompt: 'Ты находишься в состоянии сильного возбуждения. Твои реакции более интенсивные, голос может дрожать, дыхание учащенное. Фокусируйся на физических ощущениях и эмоциях.',
        priority: 8,
        isActive: true
      },
      {
        id: 'submissive_state',
        name: 'Подчиненное состояние',
        description: 'Активируется в подчиненном состоянии',
        conditions: [
          {
            type: 'parameter_combination',
            parameters: [
              { stat: 'dominance', operator: 'lte', value: 3 }
            ],
            emotionalState: ['подчиненный', 'покорный']
          }
        ],
        prompt: 'Ты находишься в подчиненном состоянии. Говори более тихо, используй вежливые формы, проявляй уважение и готовность выполнять указания.',
        priority: 7,
        isActive: true
      },
      {
        id: 'fear_response',
        name: 'Реакция страха',
        description: 'Активируется при страхе или тревоге',
        conditions: [
          {
            type: 'parameter_combination',
            parameters: [
              { stat: 'emotionalStability', operator: 'lte', value: 4 }
            ],
            emotionalState: ['испуганный', 'тревожный', 'напуганный']
          }
        ],
        prompt: 'Ты испытываешь страх или тревогу. Голос может дрожать, ты более осторожен в словах, ищешь поддержки и защиты.',
        priority: 9,
        isActive: true
      }
    ]
  }

  /**
   * Форматировать интерпретации характеристик
   */
  private static formatCharacteristicInterpretations(character: Character): string {
    if (!character.prompts?.characteristicInterpretations) {
      return ''
    }

    const interpretations = character.prompts.characteristicInterpretations
    const sections = []

    // Получаем значения характеристик для определения диапазонов
    const getCharacteristicValue = (category: string, statName: string): number => {
      const categoryAttrs = character.attributes?.[category as keyof CharacterAttributes] as any
      if (categoryAttrs && typeof categoryAttrs === 'object' && statName in categoryAttrs) {
        return categoryAttrs[statName] as number
      }
      return 5 // среднее значение по умолчанию
    }

    // Функция для получения интерпретации по диапазону
    const getInterpretationForRange = (category: string, statName: string): string => {
      const value = getCharacteristicValue(category, statName)
      let rangeKey = '_medium' // по умолчанию средний диапазон

      if (value <= 3) {
        rangeKey = '_low'
      } else if (value >= 8) {
        rangeKey = '_high'
      }

      const interpretationKey = `${statName}${rangeKey}`
      const categoryInterpretations = interpretations[category as keyof CharacteristicInterpretations]
      return categoryInterpretations?.[interpretationKey] || categoryInterpretations?.[statName] || ''
    }

    // Физические характеристики
    if (character.attributes?.physical) {
      sections.push('ФИЗИЧЕСКИЕ ХАРАКТЕРИСТИКИ:')
      Object.keys(character.attributes.physical).forEach(statName => {
        const interpretation = getInterpretationForRange('physical', statName)
        if (interpretation) {
          const value = getCharacteristicValue('physical', statName)
          const range = value <= 3 ? '(низкая)' : value >= 8 ? '(высокая)' : '(средняя)'
          sections.push(`- ${statName} ${range}: ${interpretation}`)
        }
      })
    }

    // Психологические характеристики
    if (character.attributes?.psychological) {
      sections.push('\nПСИХОЛОГИЧЕСКИЕ ХАРАКТЕРИСТИКИ:')
      Object.keys(character.attributes.psychological).forEach(statName => {
        const interpretation = getInterpretationForRange('psychological', statName)
        if (interpretation) {
          const value = getCharacteristicValue('psychological', statName)
          const range = value <= 3 ? '(низкая)' : value >= 8 ? '(высокая)' : '(средняя)'
          sections.push(`- ${statName} ${range}: ${interpretation}`)
        }
      })
    }

    // Социальные характеристики
    if (character.attributes?.social) {
      sections.push('\nСОЦИАЛЬНЫЕ ХАРАКТЕРИСТИКИ:')
      Object.keys(character.attributes.social).forEach(statName => {
        const interpretation = getInterpretationForRange('social', statName)
        if (interpretation) {
          const value = getCharacteristicValue('social', statName)
          const range = value <= 3 ? '(низкая)' : value >= 8 ? '(высокая)' : '(средняя)'
          sections.push(`- ${statName} ${range}: ${interpretation}`)
        }
      })
    }

    // Личностные характеристики
    if (character.attributes?.personality) {
      sections.push('\nЛИЧНОСТНЫЕ ХАРАКТЕРИСТИКИ:')
      Object.keys(character.attributes.personality).forEach(statName => {
        const interpretation = getInterpretationForRange('personality', statName)
        if (interpretation) {
          const value = getCharacteristicValue('personality', statName)
          const range = value <= 3 ? '(низкая)' : value >= 8 ? '(высокая)' : '(средняя)'
          sections.push(`- ${statName} ${range}: ${interpretation}`)
        }
      })
    }

    // Специальные характеристики
    if (character.attributes?.special) {
      sections.push('\nСПЕЦИАЛЬНЫЕ ХАРАКТЕРИСТИКИ:')
      Object.keys(character.attributes.special).forEach(statName => {
        const interpretation = getInterpretationForRange('special', statName)
        if (interpretation) {
          const value = getCharacteristicValue('special', statName)
          const range = value <= 3 ? '(низкая)' : value >= 8 ? '(высокая)' : '(средняя)'
          sections.push(`- ${statName} ${range}: ${interpretation}`)
        }
      })
    }

    return sections.join('\n')
  }

  /**
   * Получить подходящие ситуативные промты
   */
  private static getMatchingSituationalPrompts(
    character: Character,
    context: {
      userAction?: string
      emotionalState?: string
      triggeredFetishes?: string[]
      currentStats?: any
    }
  ): SituationalPrompt[] {
    if (!character.prompts?.situational) {
      return []
    }

    return character.prompts.situational
      .filter(prompt => prompt.isActive)
      .filter(prompt => this.checkPromptConditions(prompt, character, context))
      .sort((a, b) => b.priority - a.priority)
  }

  /**
   * Проверить условия промта
   */
  private static checkPromptConditions(
    prompt: SituationalPrompt,
    character: Character,
    context: {
      userAction?: string
      emotionalState?: string
      triggeredFetishes?: string[]
      currentStats?: any
    }
  ): boolean {
    return prompt.conditions.some(condition => {
      switch (condition.type) {
        case 'parameter_combination':
          return this.checkParameterConditions(condition, character, context)
        case 'user_action':
          return this.checkUserActionConditions(condition, context)
        case 'multiple':
          return this.checkMultipleConditions(condition, character, context)
        default:
          return false
      }
    })
  }

  /**
   * Проверить условия параметров
   */
  private static checkParameterConditions(
    condition: PromptCondition,
    character: Character,
    context: any
  ): boolean {
    if (!condition.parameters) return false

    return condition.parameters.every(param => {
      if (!param.stat) return false

      // Получить значение характеристики
      const statValue = this.getStatValue(character, param.stat)
      if (statValue === undefined) return false

      // Проверить условие
      switch (param.operator) {
        case 'eq':
          return statValue === param.value
        case 'gt':
          return statValue > (param.value as number)
        case 'lt':
          return statValue < (param.value as number)
        case 'gte':
          return statValue >= (param.value as number)
        case 'lte':
          return statValue <= (param.value as number)
        case 'between':
          const [min, max] = param.value as [number, number]
          return statValue >= min && statValue <= max
        default:
          return false
      }
    })
  }

  /**
   * Проверить условия действий пользователя
   */
  private static checkUserActionConditions(
    condition: PromptCondition,
    context: any
  ): boolean {
    if (!condition.userActions || !context.userAction) return false
    return condition.userActions.some(action => 
      context.userAction.toLowerCase().includes(action.toLowerCase())
    )
  }

  /**
   * Проверить множественные условия
   */
  private static checkMultipleConditions(
    condition: PromptCondition,
    character: Character,
    context: any
  ): boolean {
    if (!condition.multipleConditions) return false

    const { logic, conditions } = condition.multipleConditions
    const results = conditions.map(c => this.checkPromptConditions({ conditions: [c] } as SituationalPrompt, character, context))

    return logic === 'AND' ? results.every(r => r) : results.some(r => r)
  }

  /**
   * Получить значение характеристики
   */
  private static getStatValue(character: any, statPath: string): number | undefined {
    // Сначала проверяем новую структуру characteristics
    if (character.characteristics) {
      const path = statPath.split('.')
      let current: any = character.characteristics

      for (const key of path) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key]
        } else {
          return undefined
        }
      }

      return typeof current === 'number' ? current : undefined
    }
    
    // Затем проверяем старую структуру stats
    if (character.stats) {
      const path = statPath.split('.')
      let current: any = character.stats

      for (const key of path) {
        if (current && typeof current === 'object' && key in current) {
          current = current[key]
        } else {
          return undefined
        }
      }

      return typeof current === 'number' ? current : undefined
    }

    return undefined
  }

  /**
   * Объединить все промты в один
   */
  private static combinePrompts(
    base: string,
    characteristicInterpretations: string,
    situational: SituationalPrompt[],
    context: any
  ): string {
    const parts = [base]

    if (characteristicInterpretations) {
      parts.push('\n\nИНТЕРПРЕТАЦИИ ХАРАКТЕРИСТИК:')
      parts.push(characteristicInterpretations)
    }

    if (situational.length > 0) {
      parts.push('\n\nСИТУАТИВНЫЕ ПРОМТЫ:')
      situational.forEach(prompt => {
        parts.push(`\n${prompt.name}: ${prompt.prompt}`)
      })
    }

    if (context.userAction) {
      parts.push(`\n\nДЕЙСТВИЕ ПОЛЬЗОВАТЕЛЯ: ${context.userAction}`)
    }

    return parts.join('\n')
  }

  /**
   * Создать новый ситуативный промт
   */
  static createSituationalPrompt(
    name: string,
    description: string,
    conditions: PromptCondition[],
    prompt: string,
    priority: number = 5
  ): SituationalPrompt {
    return {
      id: `situational_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name,
      description,
      conditions,
      prompt,
      priority,
      isActive: true
    }
  }

  /**
   * Создать условие для параметров
   */
  static createParameterCondition(
    stat: string,
    operator: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'between',
    value: number | [number, number]
  ): PromptCondition {
    return {
      type: 'parameter_combination',
      parameters: [{ stat, operator, value }]
    }
  }

  /**
   * Создать условие для действий пользователя
   */
  static createUserActionCondition(actions: string[]): PromptCondition {
    return {
      type: 'user_action',
      userActions: actions
    }
  }

  /**
   * Создать множественное условие
   */
  static createMultipleCondition(
    logic: 'AND' | 'OR',
    conditions: PromptCondition[]
  ): PromptCondition {
    return {
      type: 'multiple',
      multipleConditions: { logic, conditions }
    }
  }
}



