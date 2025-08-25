import { Character, CharacterFetish, FetishCategory, FetishAnalysis, FetishInfluence } from '../unified-entities'
import { statsManager } from './stats'

/**
 * Менеджер фетишей персонажей
 * Управляет активацией, изменением и влиянием фетишей
 */
export class FetishManager {
  private readonly discoveryThreshold = 0.7
  private readonly intensityChangeRate = 0.1

  /**
   * Анализирует триггеры в действии и возвращает активированные фетиши
   */
  async analyzeTriggers(action: string, character: Character): Promise<CharacterFetish[]> {
    const triggeredFetishes: CharacterFetish[] = []
    
    // Проверяем все активные фетиши
    const allFetishes = [
      ...character.fetishes.primary,
      ...character.fetishes.secondary,
      ...character.fetishes.discovered
    ]
    
    for (const fetish of allFetishes) {
      if (!fetish.isActive) continue
      
      const triggerScore = this.calculateTriggerScore(action, fetish)
      if (triggerScore > 0.3) { // Порог активации
        triggeredFetishes.push({
          ...fetish,
          lastTriggered: new Date().toISOString()
        })
      }
    }
    
    return triggeredFetishes
  }

  /**
   * Вычисляет оценку срабатывания триггера для фетиша
   */
  private calculateTriggerScore(action: string, fetish: CharacterFetish): number {
    const actionLower = action.toLowerCase()
    let totalScore = 0
    let triggerCount = 0
    
    for (const trigger of fetish.triggers) {
      const triggerLower = trigger.toLowerCase()
      
      // Проверяем точное совпадение
      if (actionLower.includes(triggerLower)) {
        totalScore += 1.0
        triggerCount++
      }
      
      // Проверяем частичное совпадение
      const words = triggerLower.split(' ')
      for (const word of words) {
        if (word.length > 3 && actionLower.includes(word)) {
          totalScore += 0.5
          triggerCount++
        }
      }
    }
    
    // Учитываем интенсивность фетиша
    const intensityMultiplier = fetish.intensity / 10
    
    return triggerCount > 0 ? (totalScore / triggerCount) * intensityMultiplier : 0
  }

  /**
   * Вычисляет влияние фетишей на ответ персонажа
   */
  async calculateFetishInfluence(
    fetishes: CharacterFetish[], 
    action: string,
    character: Character
  ): Promise<FetishInfluence> {
    if (fetishes.length === 0) {
      return {
        modifiesResponse: false,
        responseModifier: '',
        overallArousal: 0,
        dominantFetish: null
      }
    }
    
    // Находим доминирующий фетиш
    const dominantFetish = fetishes.reduce((prev, current) => 
      (current.intensity > prev.intensity) ? current : prev
    )
    
    // Вычисляем общее возбуждение
    const overallArousal = fetishes.reduce((sum, fetish) => 
      sum + (fetish.intensity / 10), 0
    ) / fetishes.length
    
    // Создаем модификатор ответа
    const responseModifier = this.generateResponseModifier(fetishes, action, character)
    
    return {
      modifiesResponse: true,
      responseModifier,
      overallArousal,
      dominantFetish
    }
  }

  /**
   * Генерирует модификатор ответа на основе активированных фетишей
   */
  private generateResponseModifier(
    fetishes: CharacterFetish[], 
    action: string,
    character: Character
  ): string {
    const modifiers = []
    
    for (const fetish of fetishes) {
      const intensity = fetish.intensity / 10
      
      if (intensity > 0.7) {
        modifiers.push(`Сильно активирован фетиш "${fetish.name}"`)
      } else if (intensity > 0.4) {
        modifiers.push(`Активирован фетиш "${fetish.name}"`)
      }
      
      // Добавляем типичные реакции
      if (fetish.reactions.length > 0) {
        const randomReaction = fetish.reactions[Math.floor(Math.random() * fetish.reactions.length)]
        modifiers.push(`Типичная реакция: "${randomReaction}"`)
      }
    }
    
    return modifiers.join('. ')
  }

  /**
   * Открывает новый фетиш для персонажа
   */
  async discoverNewFetish(
    character: Character, 
    context: any
  ): Promise<CharacterFetish | null> {
    // Проверяем готовность персонажа к открытию фетишей
    const discoveryChance = character.stats.special.fetishDiscovery / 10
    
    if (Math.random() > discoveryChance) {
      return null
    }
    
    // Анализируем контекст для определения потенциального фетиша
    const potentialFetish = this.analyzeContextForFetish(context, character)
    
    if (potentialFetish) {
      // Создаем новый фетиш
      const newFetish: CharacterFetish = {
        id: `fet_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: potentialFetish.name,
        description: potentialFetish.description,
        intensity: potentialFetish.baseIntensity || 5,
        triggers: potentialFetish.triggers || [],
        reactions: potentialFetish.reactions || [],
        category: potentialFetish.category,
        isActive: true,
        discoveredAt: new Date().toISOString()
      }
      
      // Добавляем в список открытых фетишей
      character.fetishes.discovered.push(newFetish)
      
      return newFetish
    }
    
    return null
  }

  /**
   * Анализирует контекст для определения потенциального фетиша
   */
  private analyzeContextForFetish(context: any, character: Character): any {
    // Базовые шаблоны фетишей
    const fetishTemplates = {
      domination: {
        name: 'Доминирование',
        description: 'Стремление к контролю и власти',
        baseIntensity: 6,
        triggers: ['контроль', 'власть', 'команды', 'приказы'],
        reactions: ['Я контролирую ситуацию', 'Ты будешь делать как я сказал'],
        category: FetishCategory.DOMINATION
      },
      submission: {
        name: 'Подчинение',
        description: 'Готовность подчиняться и служить',
        baseIntensity: 7,
        triggers: ['подчинение', 'служба', 'послушание'],
        reactions: ['Я подчиняюсь', 'Как вы прикажете'],
        category: FetishCategory.DOMINATION
      },
      humiliation: {
        name: 'Унижение',
        description: 'Получение удовольствия от унижения',
        baseIntensity: 5,
        triggers: ['унижение', 'оскорбления', 'стыд'],
        reactions: ['Мне стыдно', 'Я ничтожество'],
        category: FetishCategory.HUMILIATION
      },
      sensory: {
        name: 'Сенсорные ощущения',
        description: 'Интерес к различным ощущениям',
        baseIntensity: 6,
        triggers: ['ощущения', 'прикосновения', 'стимуляция'],
        reactions: ['Это так приятно', 'Я чувствую'],
        category: FetishCategory.SENSORY
      }
    }
    
    // Простая логика определения фетиша на основе контекста
    const contextText = JSON.stringify(context).toLowerCase()
    
    if (contextText.includes('контроль') || contextText.includes('власть')) {
      return fetishTemplates.domination
    }
    
    if (contextText.includes('подчинение') || contextText.includes('служба')) {
      return fetishTemplates.submission
    }
    
    if (contextText.includes('унижение') || contextText.includes('оскорбления')) {
      return fetishTemplates.humiliation
    }
    
    if (contextText.includes('ощущения') || contextText.includes('прикосновения')) {
      return fetishTemplates.sensory
    }
    
    return null
  }

  /**
   * Обновляет интенсивность фетиша
   */
  async updateFetishIntensity(fetish: CharacterFetish, impact: number): Promise<void> {
    // Изменяем интенсивность на основе воздействия
    const change = impact * this.intensityChangeRate
    
    // Ограничиваем изменение
    const newIntensity = Math.max(1, Math.min(10, fetish.intensity + change))
    fetish.intensity = newIntensity
    
    // Обновляем время последней активации
    fetish.lastTriggered = new Date().toISOString()
  }

  /**
   * Получает анализ фетишей для действия
   */
  async analyzeFetishImpact(
    action: string, 
    character: Character
  ): Promise<FetishAnalysis> {
    // Анализируем триггеры
    const triggeredFetishes = await this.analyzeTriggers(action, character)
    
    // Вычисляем общее возбуждение
    const overallArousal = triggeredFetishes.length > 0 
      ? triggeredFetishes.reduce((sum, fetish) => sum + (fetish.intensity / 10), 0) / triggeredFetishes.length
      : 0
    
    // Находим доминирующий фетиш
    const dominantFetish = triggeredFetishes.length > 0
      ? triggeredFetishes.reduce((prev, current) => 
          (current.intensity > prev.intensity) ? current : prev
        )
      : undefined
    
    return {
      triggeredFetishes,
      overallArousal,
      dominantFetish
    }
  }

  /**
   * Получает описание фетиша по категории
   */
  getFetishCategoryDescription(category: FetishCategory): string {
    const descriptions = {
      [FetishCategory.DOMINATION]: 'Доминирование и подчинение',
      [FetishCategory.HUMILIATION]: 'Унижение и стыд',
      [FetishCategory.DEPENDENCY]: 'Зависимость и контроль',
      [FetishCategory.SENSORY]: 'Сенсорные ощущения',
      [FetishCategory.ROLEPLAY]: 'Ролевые игры',
      [FetishCategory.PHYSICAL]: 'Физические действия',
      [FetishCategory.PSYCHOLOGICAL]: 'Психологические аспекты',
      [FetishCategory.SOCIAL]: 'Социальные роли'
    }
    
    return descriptions[category] || 'Неизвестная категория'
  }

  /**
   * Получает сводку фетишей персонажа
   */
  getCharacterFetishesSummary(character: Character): string {
    const summary = []
    
    if (character.fetishes.primary.length > 0) {
      summary.push('**Основные фетиши:**')
      character.fetishes.primary.forEach(fetish => {
        summary.push(`- ${fetish.name} (${fetish.intensity}/10): ${fetish.description}`)
        summary.push(`  Триггеры: ${fetish.triggers.join(', ')}`)
        summary.push(`  Реакции: ${fetish.reactions.join(', ')}`)
      })
    }
    
    if (character.fetishes.secondary.length > 0) {
      summary.push('\n**Дополнительные фетиши:**')
      character.fetishes.secondary.forEach(fetish => {
        summary.push(`- ${fetish.name} (${fetish.intensity}/10): ${fetish.description}`)
      })
    }
    
    if (character.fetishes.discovered.length > 0) {
      summary.push('\n**Открытые фетиши:**')
      character.fetishes.discovered.forEach(fetish => {
        summary.push(`- ${fetish.name} (${fetish.intensity}/10): ${fetish.description}`)
        if (fetish.discoveredAt) {
          summary.push(`  Открыт: ${new Date(fetish.discoveredAt).toLocaleDateString()}`)
        }
      })
    }
    
    return summary.join('\n')
  }

  /**
   * Проверяет совместимость фетишей
   */
  checkFetishCompatibility(fetish1: CharacterFetish, fetish2: CharacterFetish): boolean {
    // Простая логика совместимости
    const incompatiblePairs = [
      [FetishCategory.DOMINATION, FetishCategory.DOMINATION], // Два доминирующих фетиша
      [FetishCategory.HUMILIATION, FetishCategory.HUMILIATION] // Два фетиша унижения
    ]
    
    for (const [cat1, cat2] of incompatiblePairs) {
      if ((fetish1.category === cat1 && fetish2.category === cat2) ||
          (fetish1.category === cat2 && fetish2.category === cat1)) {
        return false
      }
    }
    
    return true
  }

  /**
   * Создает базовые фетиши для архетипа
   */
  createBaseFetishes(archetype: string): CharacterFetish[] {
    const baseFetishes: { [key: string]: CharacterFetish[] } = {
      'feminine_student': [
        {
          id: 'fet_submission_001',
          name: 'Подчинение',
          description: 'Готовность подчиняться авторитетам',
          intensity: 8,
          triggers: ['приказы', 'команды', 'руководство', 'контроль'],
          reactions: ['Что вы хотите от меня?', 'Я подчиняюсь', 'Приказывайте мне'],
          category: FetishCategory.DOMINATION,
          isActive: true
        },
        {
          id: 'fet_dependency_001',
          name: 'Зависимость',
          description: 'Потребность в руководстве и поддержке',
          intensity: 7,
          triggers: ['забота', 'помощь', 'финансовая поддержка', 'руководство'],
          reactions: ['Мне нужна ваша помощь', 'Я зависим от вас', 'Не оставляйте меня'],
          category: FetishCategory.DEPENDENCY,
          isActive: true
        },
        {
          id: 'fet_humiliation_001',
          name: 'Унижение',
          description: 'Получение удовольствия от унижения',
          intensity: 6,
          triggers: ['унижение', 'оскорбления', 'стыд', 'позор'],
          reactions: ['Мне стыдно', 'Я ничтожество', 'Накажите меня'],
          category: FetishCategory.HUMILIATION,
          isActive: true
        }
      ],
      'dominant_master': [
        {
          id: 'fet_domination_001',
          name: 'Доминирование',
          description: 'Стремление к контролю и власти',
          intensity: 9,
          triggers: ['контроль', 'власть', 'команды', 'приказы'],
          reactions: ['Я контролирую ситуацию', 'Ты будешь делать как я сказал', 'Подчиняйся мне'],
          category: FetishCategory.DOMINATION,
          isActive: true
        },
        {
          id: 'fet_control_001',
          name: 'Контроль',
          description: 'Потребность контролировать других',
          intensity: 8,
          triggers: ['управление', 'контроль', 'дисциплина', 'наказание'],
          reactions: ['Я управляю тобой', 'Ты под моим контролем', 'Слушайся меня'],
          category: FetishCategory.DOMINATION,
          isActive: true
        }
      ]
    }
    
    return baseFetishes[archetype] || baseFetishes['feminine_student']
  }
}

// Экспортируем экземпляр для использования
export const fetishManager = new FetishManager()
