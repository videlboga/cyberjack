import { Character, CharacterPrompts, SituationalPrompt, PromptCondition, CharacteristicInterpretations } from '../unified-entities'

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

    // Физические характеристики
    if (Object.keys(interpretations.physical).length > 0) {
      sections.push('ФИЗИЧЕСКИЕ ХАРАКТЕРИСТИКИ:')
      Object.entries(interpretations.physical).forEach(([key, value]) => {
        sections.push(`- ${key}: ${value}`)
      })
    }

    // Психологические характеристики
    if (Object.keys(interpretations.psychological).length > 0) {
      sections.push('\nПСИХОЛОГИЧЕСКИЕ ХАРАКТЕРИСТИКИ:')
      Object.entries(interpretations.psychological).forEach(([key, value]) => {
        sections.push(`- ${key}: ${value}`)
      })
    }

    // Социальные характеристики
    if (Object.keys(interpretations.social).length > 0) {
      sections.push('\nСОЦИАЛЬНЫЕ ХАРАКТЕРИСТИКИ:')
      Object.entries(interpretations.social).forEach(([key, value]) => {
        sections.push(`- ${key}: ${value}`)
      })
    }

    // Личностные характеристики
    if (Object.keys(interpretations.personality).length > 0) {
      sections.push('\nЛИЧНОСТНЫЕ ХАРАКТЕРИСТИКИ:')
      Object.entries(interpretations.personality).forEach(([key, value]) => {
        sections.push(`- ${key}: ${value}`)
      })
    }

    // Специальные характеристики
    if (Object.keys(interpretations.special).length > 0) {
      sections.push('\nСПЕЦИАЛЬНЫЕ ХАРАКТЕРИСТИКИ:')
      Object.entries(interpretations.special).forEach(([key, value]) => {
        sections.push(`- ${key}: ${value}`)
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



